I will enhance the Dashboard visualization as follows:

1. **Refine MAE Regression Chart**:

   * **Slimmer Bars**: Reduce `maxColumnWidth` to `20` to prevent bars from looking too thick.

   * **Prevent Overflow**: Increase `appendPadding` and optimize `xAxis` label settings (auto-rotate) to keep the chart neatly inside the card.

   * **Visual Polish**: Apply a specific color (Ant Design Blue) for a cleaner, more professional look.

2. **Highlight Best Metrics (Classification)**:

   * **Add Logic**: Calculate `bestPrecision` and `bestRecall` across all algorithms.

   * **Apply Highlighting**: Update the table columns to **bold** and highlight (in red) the best Precision and Recall values, matching the existing style for Accuracy and F1.

3. **Add Sample Count (Support) to Detailed Reports**:

   * **Summary Statistic**: Add a "Total Samples" (样本总数) statistic to the top of each algorithm's detail card.

   * **Class-level Detail**: Add a "Support" (样本数) column to the detailed table for each class, showing how many samples belong to that category.

