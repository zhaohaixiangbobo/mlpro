# 修复 Prediction.tsx 中的 Ant Design Steps 组件用法

**问题原因**:
项目使用的是 Ant Design v6 (`"antd": "^6.1.2"`), 该版本中 `Steps` 组件已不再支持使用 `<Step>` 子组件的写法（这是 v4 的旧写法），而是需要通过 `items` 属性来配置步骤内容。这导致了：
1. `const { Step } = Steps;` 报错。
2. 页面无法渲染步骤条，从而导致包含在步骤描述中的“选择工作流”下拉框无法显示。

**修复方案**:
重构 `Prediction.tsx` 中的 `Steps` 组件，改用 `items` 属性数组来定义步骤。

**具体修改**:
1.  删除 `const { Step } = Steps;`。
2.  将 JSX 中的 `<Steps> <Step ... /> ... </Steps>` 结构改为 `<Steps items={[...]} />`。
3.  将原本 `<Step>` 的 `title` and `description` 属性迁移到 `items` 数组的对象中。

**代码变更预览**:
```tsx
// 删除
// const { Step } = Steps;

// 修改前
<Steps direction="vertical" current={-1}>
    <Step title="选择工作流" description={...} />
    ...
</Steps>

// 修改后
<Steps 
    direction="vertical" 
    current={-1}
    items={[
        {
            title: "选择工作流",
            description: (
                <Select ...>...</Select>
            )
        },
        // ... 其他步骤
    ]}
/>
```
