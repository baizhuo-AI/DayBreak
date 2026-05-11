# Tauri Shell

The JavaScript design system is wired for Tauri, but this workspace does not currently have Rust installed. `src-tauri/` is therefore checked in as a ready-to-complete shell rather than a verified native build.

## To verify locally

1. Install Rust and the Tauri native prerequisites.
2. Run `npm run tauri:dev`.
3. Confirm the panel opens at `240x400` and the collapsed capsule still reads cleanly.
