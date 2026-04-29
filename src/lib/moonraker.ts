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
  process.env.EXPO_PUBLIC_MOONRAKER_URL ??
  process.env.MOONRAKER_URL ??
  "http://pillo.local:7125";

const TOTAL_BAYS = 8;

const BAY_ANGLES: Record<number, number> = {
  1: 20,
  2: 65,
  3: 110,
  4: 155,
  5: 200,
  6: 245,
  7: 290,
  8: 335,
};

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function gcodePost(script: string): Promise<void> {
  const res = await fetch(`${MOONRAKER_URL}/printer/gcode/script`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ script }),
  });
  if (!res.ok)
    throw new Error(`Moonraker gcode error ${res.status}: ${script}`);
}

// ─── Public types ────────────────────────────────────────────────────────────

/** Signature for the new dispenseSequence — importable by the weekly fill screen */
export type DispenseSequenceFn = (
  cabinets: number[],
  onProgress?: (msg: string) => void,
  startY?: number,
) => Promise<number>;

export type MachineState =
  | "ready"
  | "printing"
  | "paused"
  | "error"
  | "shutdown"
  | "startup"
  | "unreachable";

export interface MachineStatus {
  state: MachineState;
  message: string;
}

export interface DispenseProgressEvent {
  type: "homing" | "moving" | "picking" | "delivering" | "done" | "error";
  bay?: number;
  patientName?: string;
  step?: number;
  total?: number;
  message: string;
}

// ─── Status check ────────────────────────────────────────────────────────────

export async function getMachineStatus(): Promise<MachineStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${MOONRAKER_URL}/printer/info`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { state: "error", message: `HTTP ${res.status}` };
    const json = (await res.json()) as {
      result: { state: string; state_message: string };
    };
    return {
      state: json.result.state as MachineState,
      message: json.result.state_message ?? "",
    };
  } catch (e) {
    clearTimeout(timer);
    return {
      state: "unreachable",
      message: `Cannot reach ${MOONRAKER_URL} — ${e instanceof Error ? e.message : "check WiFi"}`,
    };
  }
}

// ─── Standalone hardware controls ────────────────────────────────────────────

export async function homeAllAxes(): Promise<void> {
  await gcodePost("G28");
  await delay(2000);
}

// Move a bay to the fill/restock position (for loading medications)
export async function moveBayToFill(bay: number): Promise<void> {
  if (bay < 1 || bay > TOTAL_BAYS)
    throw new Error(`Invalid bay number: ${bay}`);
  await gcodePost(`MOVE_TO_INSERT_BAY BAY=${bay}`);
}

// ─── LED helpers (drawer is 0-indexed: drawer = bay - 1) ─────────────────────

export async function setBayLed(
  bay: number,
  color: "green" | "red" | "white" | "blue" | "off",
): Promise<void> {
  const drawer = bay - 1;
  if (color === "off") {
    await gcodePost(`DRAWER_LED_OFF DRAWER=${drawer}`);
    return;
  }
  const map = {
    green: [0, 1, 0],
    red: [1, 0, 0],
    white: [1, 1, 1],
    blue: [0, 0, 1],
  };
  const [r, g, b] = map[color];
  await gcodePost(`DRAWER_LED_ON DRAWER=${drawer} R=${r} G=${g} B=${b}`);
}

export async function clearAllLeds(): Promise<void> {
  await gcodePost("DRAWER_LED_ALL_OFF");
}

// ─── Main dispense sequence ───────────────────────────────────────────────────
// Homes the machine, then for each bay: positions gripper (MOVE_TO_BAY),
// picks the pill (PICK), moves to delivery tray (X=0), and releases (RELEASE).

export async function runDispenseSequence(
  bays: { bay: number; patientName: string }[],
  onProgress: (event: DispenseProgressEvent) => void,
): Promise<void> {
  if (bays.length === 0) return;

  onProgress({ type: "homing", message: "Homing all axes..." });
  await gcodePost("G28");
  await delay(2000);

  for (let i = 0; i < bays.length; i++) {
    const { bay, patientName } = bays[i];
    if (bay < 1 || bay > TOTAL_BAYS)
      throw new Error(`Invalid bay number: ${bay}`);

    onProgress({
      type: "moving",
      bay,
      patientName,
      step: i + 1,
      total: bays.length,
      message: `Moving to bay ${bay} for ${patientName}...`,
    });

    // MOVE_TO_BAY: raises Z to top, moves X to 24mm, rotates Y to bay angle
    await gcodePost(`MOVE_TO_BAY BAY=${bay}`);
    await delay(500);

    // Light bay white only after the machine has physically arrived
    await setBayLed(bay, "white");

    onProgress({
      type: "picking",
      bay,
      patientName,
      step: i + 1,
      total: bays.length,
      message: `Dispensing for ${patientName}...`,
    });

    // PICK: lowers Z to 25mm → waits → activates vacuum → waits → raises Z to 60mm
    await gcodePost("PICK");
    await delay(200);

    // Move to delivery tray at X=0
    await gcodePost("MOVE_X POS=0");
    await delay(400);

    // Drop pill — Z is already at top after PICK so GRIPPER_OFF is sufficient
    await gcodePost("GRIPPER_OFF");
    await delay(300);

    // Turn bay LED green after successful dispense
    await setBayLed(bay, "green");

    onProgress({
      type: "delivering",
      bay,
      patientName,
      step: i + 1,
      total: bays.length,
      message: `✓ ${patientName} dispensed`,
    });
  }

  await clearAllLeds();
  onProgress({
    type: "done",
    message: "All medications dispensed successfully",
  });
}

// ─── New dispense helpers (web-app parity) ───────────────────────────────────

export async function gripperPickAndDeliver(): Promise<void> {
  await gcodePost("PICK");
  await delay(200);
  await gcodePost("MOVE_X POS=0");
  await delay(400);
  await gcodePost("GRIPPER_OFF");
  await delay(300);
}

export async function dispenseFromCabinet(cabinet: number): Promise<void> {
  if (cabinet < 1 || cabinet > TOTAL_BAYS) {
    throw new Error(
      `Invalid cabinet number: ${cabinet}. Must be 1–${TOTAL_BAYS}`,
    );
  }
  try {
    await gcodePost(`MOVE_TO_BAY BAY=${cabinet}`);
    await delay(500);
    await setBayLed(cabinet, "white");
    await gripperPickAndDeliver();
    await setBayLed(cabinet, "green");
  } catch (err) {
    await setBayLed(cabinet, "red").catch(() => {});
    throw err;
  }
}

/**
 * Dispenses from a list of cabinet numbers.
 * If startY is provided the machine is assumed to be already positioned and
 * homing is skipped. Returns the last Y angle used so callers can chain meals.
 */
export const dispenseSequence: DispenseSequenceFn = async (
  cabinets,
  onProgress,
  startY,
) => {
  if (startY === undefined) {
    onProgress?.("Homing all axes...");
    await gcodePost("G28");
    await delay(3000);
  }

  let lastY = startY ?? 0;

  for (const cabinet of cabinets) {
    const angle = BAY_ANGLES[cabinet];
    if (angle === undefined) throw new Error(`Unknown cabinet: ${cabinet}`);

    onProgress?.(`Moving to cabinet ${cabinet} (Y=${angle}°)...`);
    await dispenseFromCabinet(cabinet);
    lastY = angle;

    onProgress?.(`Cabinet ${cabinet} dispensed`);
  }

  return lastY;
};

// ─── Emergency stop ───────────────────────────────────────────────────────────

export async function emergencyStop(): Promise<void> {
  await fetch(`${MOONRAKER_URL}/printer/emergency_stop`, { method: "POST" });
}

// Recovers from an emergency-stop / M112 shutdown. Call this after the
// physical cause is resolved — equivalent to FIRMWARE_RESTART in the console.
export async function firmwareRestart(): Promise<void> {
  await fetch(`${MOONRAKER_URL}/printer/firmware_restart`, { method: "POST" });
}
