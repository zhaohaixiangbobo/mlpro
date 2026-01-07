# Dashboard Visualization Enhancement Plan

## 1. Improve "Empty State" Handling
- **Objective**: Differentiate between "no algorithms run" and "algorithms ran but no results found".
- **Action**: 
    - In `Dashboard.tsx`, track whether any successful algorithm nodes (`algoNodes`) exist.
    - If `algoResults` is empty but successful algorithm nodes exist, display a specific hint: "算法已成功运行，但未检测到评估节点或结果数据。" (Algorithms ran successfully but no evaluation node/results detected).
    - **Bonus Fix**: Re-integrate the logic to try extracting results directly from the Algorithm Node (as proposed previously), which might solve the "no data" issue for `test6` entirely if the data exists there.

## 2. Optimize MAE Chart Styling
- **Objective**: Fix the "three evenly divided bars are too large" issue.
- **Action**:
    - In the Regression `Column` chart configuration:
        - Reduce `maxColumnWidth` to `20` (making bars slimmer).
        - Add `columnWidthRatio: 0.4` to prevent bars from expanding to fill available space excessively.
        - Ensure the chart doesn't look "bloated" with few data points.

## 3. Implementation Steps
1.  Modify `Dashboard.tsx`:
    - Update `handleWorkflowChange` to set a `hasSuccessfulAlgos` flag.
    - Update `handleWorkflowChange` to check `algoNode.data.result` as a fallback source for results.
    - Update the `return` JSX to conditionally render the new Empty state message.
    - Update `renderRegressionSection` to adjust `Column` chart props (`maxColumnWidth`, `columnWidthRatio`).
