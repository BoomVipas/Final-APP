/**
 * src/lib/moonraker.ts
 * Routes hardware commands through the PILLo web app (Next.js) which proxies
 * them to Moonraker on localhost:7125. The web app URL is set via
 * EXPO_PUBLIC_MOONRAKER_URL in .env.local (e.g. http://192.168.31.120:3000).
 */

const BASE_URL =
  process.env.EXPO_PUBLIC_MOONRAKER_URL ?? 'http://192.168.31.120:3000'

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
const FEEDRATE_Z  = 300

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Sends a G-code command through the web app proxy at /api/gcode
async function gcodePost(script: string): Promise<void> {
  console.log(`[PILLo] → GCODE: ${script}`)
  const res = await fetch(`${BASE_URL}/api/gcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script }),
  })
  if (!res.ok) {
    console.error(`[PILLo] ✗ GCODE failed (${res.status}): ${script}`)
    throw new Error(`Gcode error ${res.status}: ${script}`)
  }
  console.log(`[PILLo] ✓ GCODE ok: ${script}`)
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

// ─── Status check ─────────────────────────────────────────────────────────────
// Calls /api/printer/info on the web app proxy

export async function getMachineStatus(): Promise<MachineStatus> {
  console.log(`[PILLo] Checking machine status via ${BASE_URL}/api/printer/info ...`)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`${BASE_URL}/api/printer/info`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))

    if (!res.ok) {
      console.warn(`[PILLo] Status HTTP ${res.status}`)
      return { state: 'error', message: `HTTP ${res.status}` }
    }
    const json = await res.json() as { result: { state: string; state_message: string } }
    console.log(`[PILLo] Machine state: ${json.result.state} — ${json.result.state_message}`)
    return {
      state: json.result.state as MachineState,
      message: json.result.state_message ?? '',
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[PILLo] Machine unreachable: ${msg}`)
    return { state: 'unreachable', message: msg }
  }
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

export async function setSlotLed(slot: number, color: 'green' | 'red' | 'white' | 'blue' | 'off'): Promise<void> {
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

export async function homeAllAxes(): Promise<void> {
  await gcodePost('G28')
}

// ─── Main dispense sequence ──────────────────────────────────────────────────

export async function runDispenseSequence(
  cabinets: { cabinet: number; patientName: string }[],
  onProgress: (event: DispenseProgressEvent) => void,
): Promise<void> {
  if (cabinets.length === 0) return

  onProgress({ type: 'homing', message: 'Homing all axes...' })
  await gcodePost('G28')
  await delay(2000)

  let currentY = 0

  for (let i = 0; i < cabinets.length; i++) {
    const { cabinet, patientName } = cabinets[i]
    const pos = CABINET_POSITIONS[cabinet]
    if (!pos) throw new Error(`Invalid cabinet position: ${cabinet}`)

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
}

// Move machine to the fill Y position of cabinet slot N
export async function moveCabinetToFill(cabinet: number): Promise<void> {
  const pos = CABINET_POSITIONS[cabinet]
  if (!pos) throw new Error(`Invalid cabinet: ${cabinet}`)
  await gcodePost(`G90`)
  await gcodePost(`G1 Y${pos.fillY} F${FEEDRATE_XY}`)
}

// Dispense an ordered list of slot indices (1-based prescription order).
// Homes once, then visits each slot's dispenseY in sequence.
export async function dispenseSequence(
  indices: number[],
  onProgress?: (msg: string) => void,
): Promise<void> {
  if (indices.length === 0) return
  onProgress?.('Homing all axes...')
  await gcodePost('G28')
  await delay(2000)
  let currentY = 0
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i]
    const pos = CABINET_POSITIONS[idx]
    if (!pos) throw new Error(`Invalid cabinet index: ${idx}`)
    const deltaY = pos.dispenseY - currentY
    onProgress?.(`[${i + 1}/${indices.length}] Cabinet #${idx} — moving Y by ${deltaY}`)
    await gcodePost(`G91`)
    await gcodePost(`G1 Y${deltaY} F${FEEDRATE_XY}`)
    await gcodePost(`G90`)
    await delay(1000)
    onProgress?.(`Gripping from cabinet #${idx}...`)
    await gripperPickAndDeliver()
    currentY = pos.dispenseY
    onProgress?.(`Cabinet #${idx} done ✓`)
  }
}

export async function emergencyStop(): Promise<void> {
  await fetch(`${BASE_URL}/api/printer/emergency-stop`, { method: 'POST' })
}
