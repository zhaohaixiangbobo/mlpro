I have identified the cause of the single-color issue. In the Radar chart configuration, when `seriesField` is used, the `color` callback receives the **series name string** directly, but the current code attempts to access `.name` on it (which is undefined for a string), causing it to fall back to the default blue color for every series.

### Plan to Fix
1.  **Update Radar Chart Color Logic**:
    *   Modify the `color` prop in `d:\2-code\mlpro\frontend\src\pages\Dashboard.tsx`.
    *   Change `(datum) => seriesColorMap.get(datum?.name)` to `(seriesName) => seriesColorMap.get(seriesName)`.
    *   This will correctly retrieve the unique color assigned to each algorithm.

2.  **Verify Scaling**:
    *   Retain the existing dynamic scaling logic (`radarMin`, `radarMax`) which effectively "zooms in" on the differences between algorithms by ignoring the empty space from 0 to the lowest score.

### Verification
*   **Lint**: Run `npm run lint` to ensure no new type errors.
*   **Build**: Run `npm run build` to confirm the fix doesn't break the build.
