/**
 * src/lib/moonraker.ts
 * React Native compatible Moonraker/Klipper API client using fetch.
 * Connects to the PILLo dispenser hardware on the local network.
 *
 * Set EXPO_PUBLIC_MOONRAKER_URL in .env.local to override the default.
 *
 * Hardware: FYSETC Cheetah V3.0 (STM32F446xx)
 * - X axis: 0–80mm (gripper lateral, bay_x = 24mm)
 * - Y axis: rotary carousel –360° to +360° (bay0 = 20°, spacing = 45°)
 * - Z axis: 0–60mm (60 = top/home, 25 = grip position)
 * - Bays: 1–8 (1-indexed), Drawers: 0–8 (0-indexed, for LEDs)
 */

const MOONRAKER_URL =
  process.env.EXPO_PUBLIC_MOONRAKER_URL ?? 'http://pillo.local:7125'

const TOTAL_BAYS = 8

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
  bay?: number
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

// Move a bay to the fill/restock position (for loading medications)
export async function moveBayToFill(bay: number): Promise<void> {
  if (bay < 1 || bay > TOTAL_BAYS) throw new Error(`Invalid bay number: ${bay}`)
  await gcodePost(`MOVE_TO_INSERT_BAY BAY=${bay}`)
}

// ─── LED helpers (drawer is 0-indexed: drawer = bay - 1) ─────────────────────

export async function setBayLed(bay: number, color: 'green' | 'red' | 'white' | 'blue' | 'off'): Promise<void> {
  const drawer = bay - 1
  if (color === 'off') {
    await gcodePost(`DRAWER_LED_OFF DRAWER=${drawer}`)
    return
  }
  const map = { green: [0, 1, 0], red: [1, 0, 0], white: [1, 1, 1], blue: [0, 0, 1] }
  const [r, g, b] = map[color]
  await gcodePost(`DRAWER_LED_ON DRAWER=${drawer} R=${r} G=${g} B=${b}`)
}

export async function clearAllLeds(): Promise<void> {
  await gcodePost('DRAWER_LED_ALL_OFF')
}

// ─── Main dispense sequence ───────────────────────────────────────────────────
// Homes the machine, then for each bay: positions gripper (MOVE_TO_BAY),
// picks the pill (PICK), moves to delivery tray (X=0), and releases (RELEASE).

export async function runDispenseSequence(
  bays: { bay: number; patientName: string }[],
  onProgress: (event: DispenseProgressEvent) => void,
): Promise<void> {
  if (bays.length === 0) return

  onProgress({ type: 'homing', message: 'Homing all axes...' })
  await gcodePost('G28')
  await delay(2000)

  for (let i = 0; i < bays.length; i++) {
    const { bay, patientName } = bays[i]
    if (bay < 1 || bay > TOTAL_BAYS) throw new Error(`Invalid bay number: ${bay}`)

    // Light bay white to indicate it is about to be accessed
    await setBayLed(bay, 'white')

    onProgress({
      type: 'moving',
      bay,
      patientName,
      step: i + 1,
      total: bays.length,
      message: `Moving to bay ${bay} for ${patientName}...`,
    })

    // MOVE_TO_BAY: raises Z to top, moves X to 24mm, rotates Y to bay angle
    await gcodePost(`MOVE_TO_BAY BAY=${bay}`)
    await delay(500)

    onProgress({
      type: 'picking',
      bay,
      patientName,
      step: i + 1,
      total: bays.length,
      message: `Dispensing for ${patientName}...`,
    })

    // PICK: lowers Z to 25mm → waits → activates vacuum → waits → raises Z to 60mm
    await gcodePost('PICK')
    await delay(200)

    // Move to delivery tray at X=0
    await gcodePost('MOVE_X POS=0')
    await delay(400)

    // Drop pill — Z is already at top after PICK so GRIPPER_OFF is sufficient
    await gcodePost('GRIPPER_OFF')
    await delay(300)

    // Turn bay LED green after successful dispense
    await setBayLed(bay, 'green')

    onProgress({
      type: 'delivering',
      bay,
      patientName,
      step: i + 1,
      total: bays.length,
      message: `✓ ${patientName} dispensed`,
    })
  }

  await clearAllLeds()
  onProgress({ type: 'done', message: 'All medications dispensed successfully' })
}

// ─── Emergency stop ───────────────────────────────────────────────────────────

export async function emergencyStop(): Promise<void> {
  await fetch(`${MOONRAKER_URL}/printer/emergency_stop`, { method: 'POST' })
}
