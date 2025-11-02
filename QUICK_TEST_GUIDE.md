# 🚀 快速测试指南

## 准备工作

1. **启动服务器**
   ```bash
   npm run dev
   ```

2. **打开浏览器**
   - 访问显示的地址（通常是 http://localhost:5173）
   - 按 F12 打开开发者工具
   - 切换到 Console 标签

3. **准备测试图片**
   - 找一张包含多个物体的照片
   - 建议：桌面物品、室外场景、动物照片

---

## 测试流程

### ✅ 测试 1：上传与自动分割

**操作：**
1. 点击上传按钮或拖拽图片到页面
2. 等待 3-5 秒

**观察控制台，应该看到：**
```
📤 Starting segmentation for uploaded image...
Raw API response (first 500 chars): {"box_2d": ...
Extracted 3 objects from response
Object 0: box=[100,200,300,400], maskFile size=12345 bytes
✅ Mask file validated: 12345 bytes, type: image/png
Object 1: box=[150,250,350,450], maskFile size=12456 bytes
✅ Mask file validated: 12456 bytes, type: image/png
...
✅ Segmentation completed. Found 3 objects.
✅ Segmentation successful: 3 objects found
```

**✅ 成功标准：**
- 看到 "✅ Segmentation successful: X objects found"
- 物体数量 > 0
- 每个物体的 maskFile size > 0

**❌ 如果失败：**
- 检查是否有红色错误日志
- 确认 API Key 是否配置正确
- 查看 "Raw API response" 内容

---

### ✅ 测试 2：悬停高亮

**操作：**
1. 鼠标移动到图片上
2. 慢慢移动鼠标

**观察页面，应该看到：**
- 鼠标悬停在物体上时，出现**绿色虚线边框**
- 移开鼠标，高亮消失
- 不同物体有不同的高亮区域

**观察控制台，应该看到：**
```
Canvas size: 1920x1080, Image size: 1920x1080, Objects: 3
```

**✅ 成功标准：**
- 高亮区域与实际物体对齐
- Canvas size 与 Image size 一致
- 悬停响应流畅

**❌ 如果失败：**
- 高亮位置偏移 → Canvas 尺寸问题
- 没有高亮 → 检查 isActive 状态

---

### ✅ 测试 3：点击选择

**操作：**
1. 点击图片上的一个物体
2. 观察变化

**观察页面，应该看到：**
- 被点击的物体变成**蓝色实线边框**
- 右侧面板显示 "Object selected"
- Generate 按钮变为可用状态

**观察控制台，应该看到：**
```
✅ Object selected: obj_1, box=[150,200,450,600]
```

**✅ 成功标准：**
- 点击的物体被正确选中
- 控制台显示正确的物体 ID
- UI 状态更新

**❌ 如果失败：**
- 点击无响应 → 检查坐标转换逻辑
- 选中错误物体 → 检查 box 坐标

---

### ✅ 测试 4：编辑生成

**操作：**
1. 确保已选中一个物体（蓝色边框）
2. 在输入框输入编辑指令，例如：
   - "change to red color"
   - "make it blue"
   - "turn into a dog"
3. 点击 Generate 按钮
4. 等待 10-15 秒

**观察控制台，应该看到：**
```
📤 Generating edit with object: obj_1, prompt: "change to red color"
Mask file size: 12345 bytes, type: image/png
✅ Edit completed successfully
```

**观察页面，应该看到：**
- 显示 "AI is working its magic..." 加载提示
- 编辑完成后，图片更新
- 选中的物体被精确修改
- 其他部分保持不变

**✅ 成功标准：**
- 编辑结果精确（只修改选中物体）
- 控制台显示掩码文件信息
- 看到 "✅ Edit completed successfully"

**❌ 如果失败：**
- 编辑不精确 → 检查掩码文件
- API 错误 → 查看错误日志

---

### ✅ 测试 5：对比功能

**操作：**
1. 编辑完成后
2. 按住眼睛按钮（Compare）
3. 松开按钮

**观察页面，应该看到：**
- 按住时：显示原始图片
- 松开时：显示编辑后的图片
- 切换流畅

**✅ 成功标准：**
- 对比功能正常工作
- 没有额外的图片显示

---

### ✅ 测试 6：重新分割

**操作：**
1. 点击 "Re-segment" 按钮
2. 等待 3-5 秒

**观察控制台，应该看到：**
```
📤 Starting segmentation for uploaded image...
✅ Segmentation successful: X objects found
```

**✅ 成功标准：**
- 重新分割成功
- 物体列表更新
- 之前的选择被清除

---

## 边界情况测试

### 测试 7：空白图片
- 上传纯色背景图片
- 应该显示错误："No objects detected"

### 测试 8：快速点击
- 快速点击多个物体
- 应该正确切换选择

### 测试 9：未选择物体就编辑
- 不选择物体，直接点击 Generate
- 应该显示错误："Please select an object to edit"

---

## 成功标准总结

✅ **所有 6 个主要测试通过**
✅ **控制台日志清晰完整**
✅ **编辑结果精确**
✅ **用户体验流畅**

---

## 问题排查

### 问题 1：分割失败
**症状：** 上传后显示错误
**检查：**
1. 控制台是否有 "❌ Segmentation error"
2. 查看 "Raw API response" 内容
3. 确认 API Key 配置：检查 `.env` 文件中的 `VITE_API_KEY`

### 问题 2：点击无响应
**症状：** 点击物体没有反应
**检查：**
1. 控制台是否显示 "Canvas size" 日志
2. Canvas 尺寸是否与 Image 尺寸一致
3. 是否看到 "❌ No object found at click position"

### 问题 3：编辑不精确
**症状：** 编辑了错误的区域
**检查：**
1. 控制台中的 "Mask file size" 是否 > 0
2. 选中的物体 ID 是否正确
3. 尝试重新分割

---

## 下一步

测试完成后，记录：
1. ✅ 哪些功能正常
2. ❌ 哪些功能有问题
3. 📝 控制台的完整日志
4. 🖼️ 测试图片和结果截图
