我已找到 PCA 500 错误的根本原因：
后端 API (`api/data.py`) 调用了 `DataService.get_pca_data` 方法，但该方法实际上是在 `MLService` 类中定义的，`DataService` 并没有这个方法。这导致了 `AttributeError`，进而引发 500 错误。

此外，我也确认了 Pydantic 的警告来源并将其纳入修复计划。

### 修复计划

#### 1. 后端修复 (Critical)
*   **文件**: `backend/app/api/data.py`
*   **操作**: 
    *   引入 `MLService`。
    *   添加 `get_ml_service` 依赖注入函数。
    *   修改 `get_pca` 路由，使用 `MLService` 实例来处理 PCA 请求，替代错误的 `DataService`。

#### 2. 代码维护 (Pydantic Warning)
*   **文件**: `backend/app/api/auth.py`
*   **操作**: 将 `orm_mode = True` 更新为 `from_attributes = True`，以消除 Pydantic V2 的废弃警告。

#### 3. 验证
*   后端修复后，PCA 请求将正确路由到 `MLService.get_pca_data`，结合之前添加的 `inf/NaN` 处理和样本检查，应该能彻底解决 PCA 失败的问题。
