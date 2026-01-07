I will optimize the prediction results table display in `d:\2-code\mlpro\frontend\src\pages\Prediction.tsx` according to your feedback:

1.  **Adjust Column Widths**:
    *   Reduce the default column width from `150px` to `100px` to display more columns on the screen.
    *   Set the `prediction` column width to `120px` to ensure the 4-decimal values fit comfortably.

2.  **Selective Numeric Formatting**:
    *   Update the rendering logic to apply **4-decimal rounding** (`.toFixed(4)`) **only** to the `prediction` column.
    *   Other numeric columns will display their original values without forced formatting.

3.  **Fix Prediction Column**:
    *   Add the `fixed: 'right'` property to the `prediction` column so it remains visible while scrolling horizontally.

The changes will be applied to the `fetchTableData` function in `Prediction.tsx`.