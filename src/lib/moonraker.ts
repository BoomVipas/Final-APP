/**
 * src/lib/moonraker.ts
 * React Native compatible Moonraker/Klipper API client using fetch.
 * Connects to the PILLo dispenser hardware on the local network.
 *
 * Set EXPO_PUBLIC_MOONRAKER_URL in .env.local to override the default.
 */

const MOONRAKER_URL =
  process.env.EXPO_PUBLIC_MOONRAKER_URL ?? 'http://pillo.local:7125'

// ─── Position map (matches hardware calibration) ────────────────────────────
const CABINET_POSITIONS: Record<number, { dispenseY: number; fillY: number }> = {
  1: { dispenseY: 220, fillY: 50  },
  2: { dispenseY: 310, fillY: 140 },
  3: { dispenseY: 400, fillY: 230 },
  4: { dispenseY: 490, fillY: 320 },
  5: { dispenseY: 580, fillY: 410 },
  6: { dispenseY: 670, fillY: 500 },
  7: { dispenseY: 40,  fillY: 590 },
  8: { dispenseY: 130, fillY: 680 },
}

const DISPENSE_X  = 40
const FEEDRATE_XY = 1000
const FEEDRATE_Z  = 1000

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function gcodePost(script: string): Promise<void> {
  const res = await fetch(`${MOONRAKER_URL}/printer/gcode/script`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script }),
  })
  if (!res.ok) throw new Error(`Moonraker gcode error ${res.status}: ${script}`)
}

// ─── Public types ────────────────────────────────────────────────────────────

export type MachineState = 'ready' | 'printing' | 'paused' | 'error' | 'shutdown' | 'startup' | 'unreachable'

export interface MachineStatus {
  state: MachineState
  message: string
}

export interface DispenseProgressEvent {
  type: 'homing' | 'moving' | 'picking' | 'delivering' | 'done' | 'error'
  cabinet?: number
  patientName?: string
  step?: number
  total?: number
  message: string
}

// ─── Status check ────────────────────────────────────────────────────────────

export async function getMachineStatus(): Promise<MachineStatus> {
  try {
    const res = await fetch(`${MOONRAKER_URL}/printer/info`, {
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return { state: 'error', message: `HTTP ${res.status}` }
    const json = await res.json() as { result: { state: string; state_message: string } }
    return {
      state: json.result.state as MachineState,
      message: json.result.state_message ?? '',
    }
  } catch {
    return { state: 'unreachable', message: 'Cannot reach pillo.local — check WiFi' }
  }
}

// ─── Standalone hardware controls ────────────────────────────────────────────

export async function homeAllAxes(): Promise<void> {
  await gcodePost('G28')
  await delay(2000)
}

export async function moveCabinetToFill(cabinet: number): Promise<void> {
  const pos = CABINET_POSITIONS[cabinet]
  if (!pos) throw new Error(`Invalid cabinet number: ${cabinet}`)
  await gcodePost(`G90`)
  await gcodePost(`G1 Y${pos.fillY} F${FEEDRATE_XY}`)
}

// ─── Low-level gripper helpers ───────────────────────────────────────────────

async function gripperPickAndDeliver(): Promise<void> {
  await gcodePost(`G90`)
  await gcodePost(`G1 X${DISPENSE_X} F${FEEDRATE_XY}`)
  await delay(800)
  await gcodePost(`G91`)
  await gcodePost(`G1 Z-15 F${FEEDRATE_Z}`)
  await gcodePost(`G90`)
  await delay(500)
  await gcodePost(`GRIPPER_PICK`)
  await delay(600)
  await gcodePost(`G1 Z200 F${FEEDRATE_Z}`)
  await delay(800)
  await gcodePost(`G1 X0 F${FEEDRATE_XY}`)
  await delay(800)
  await gcodePost(`GRIPPER_RELEASE`)
  await delay(400)
}

// ─── LED helpers ─────────────────────────────────────────────────────────────

export async function setSlotLed(slot: number, color: 'green' | 'red' | 'white' | 'blue' | 'off', totalSlots = 8): Promise<void> {
  const map = { green: [0,1,0], red: [1,0,0], white: [1,1,1], blue: [0,0,1], off: [0,0,0] }
  const [r,g,b] = map[color]
  await gcodePost(`SET_LED LED=cabinet_leds RED=${r} GREEN=${g} BLUE=${b} INDEX=${slot} TRANSMIT=1`)
}

export async function clearAllLeds(totalSlots = 8): Promise<void> {
  for (let i = 1; i <= totalSlots; i++) {
    const transmit = i === totalSlots ? 1 : 0
    await gcodePost(`SET_LED LED=cabinet_leds RED=0 GREEN=0 BLUE=0 INDEX=${i} TRANSMIT=${transmit}`)
  }
}

// ─── Main dispense sequence ───────────────────────────────────────────────────
// Called with an ordered list of cabinet positions to dispense from.
// onProgress fires at every meaningful step so the UI can update in real time.

export async function runDispenseSequence(
  cabinets: { cabinet: number; patientName: string }[],
  onProgress: (event: DispenseProgressEvent) => void,
  startY?: number,
): Promise<number> {
  if (cabinets.length === 0) return startY ?? 0

  let currentY: number
  if (startY === undefined) {
    onProgress({ type: 'homing', message: 'Homing all axes...' })
    await gcodePost('G28')
    await delay(2000)
    currentY = 0
  } else {
    currentY = startY
  }

  for (let i = 0; i < cabinets.length; i++) {
    const { cabinet, patientName } = cabinets[i]
    const pos = CABINET_POSITIONS[cabinet]
    if (!pos) throw new Error(`Invalid cabinet position: ${cabinet}`)

    // Highlight the slot LED white before moving to it
    await setSlotLed(cabinet, 'white')

    onProgress({
      type: 'moving',
      cabinet,
      patientName,
      step: i + 1,
      total: cabinets.length,
      message: `Moving to cabinet ${cabinet} for ${patientName}...`,
    })

    const deltaY = pos.dispenseY - currentY
    await gcodePost(`G91`)
    await gcodePost(`G1 Y${deltaY} F${FEEDRATE_XY}`)
    await gcodePost(`G90`)
    await delay(1000)

    onProgress({
      type: 'picking',
      cabinet,
      patientName,
      step: i + 1,
      total: cabinets.length,
      message: `Dispensing for ${patientName}...`,
    })

    await gripperPickAndDeliver()

    // Turn slot LED green after successful dispense
    await setSlotLed(cabinet, 'green')

    currentY = pos.dispenseY
    onProgress({
      type: 'delivering',
      cabinet,
      patientName,
      step: i + 1,
      total: cabinets.length,
      message: `✓ ${patientName} dispensed`,
    })
  }

  await clearAllLeds()
  onProgress({ type: 'done', message: 'All medications dispensed successfully' })
  return currentY
}

export async function emergencyStop(): Promise<void> {
  await fetch(`${MOONRAKER_URL}/printer/emergency_stop`, { method: 'POST' })
}
