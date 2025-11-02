# 🧪 测试检查清单

## 苏格拉底式问题分析

### 问题 1：分割 API 能返回正确数据吗？
**测试点：**
- [ ] 上传图片后，控制台显示 "✅ Segmentation successful: X objects found"
- [ ] 检查 "Raw API response" 日志，确认返回格式正确
- [ ] 验证每个物体的 box 坐标在 0-1000 范围内
- [ ] 验证每个 maskFile 大小 > 0 bytes

**预期结果：**
```
📤 Starting segmentation for uploaded image...
Starting image segmentation...
Raw API response (first 500 chars): {"box_2d": [100, 200, 300, 400], "mask": "data:image/png;base64,..."}
Extracted 3 objects from response
Object 0: box=[100,200,300,400], maskFile size=12345 bytes
✅ Mask file validated: 12345 bytes, type: image/png
✅ Segmentation completed. Found 3 objects.
✅ Segmentation successful: 3 objects found
```

**❌ 常见错误：**
1. **模型不支持分割**
   ```
   Failed to extract objects. Full response: I can't directly give you segmentation masks...
   ```
   → 检查模型名称，应该是 `gemini-2.5-flash`，不是 `gemini-2.5-flash-image-preview`

2. **API 返回格式错误**
   ```
   Extracted 0 objects from response
   ```
   → 检查 prompt 是否正确，查看完整的 API 响应

---

### 问题 2：用户点击坐标计算准确吗？
**测试点：**
- [ ] 悬停物体时，高亮区域与实际物体对齐
- [ ] 点击物体时，控制台显示 "✅ Object selected: obj_X"
- [ ] Canvas 尺寸与图片尺寸匹配（检查日志）
- [ ] 点击空白区域时，显示 "❌ No object found at click position"

**预期结果：**
```
Canvas size: 1920x1080, Image size: 1920x1080, Objects: 3
✅ Object selected: obj_1, box=[150,200,450,600]
```

---

### 问题 3：掩码文件正确传递了吗？
**测试点：**
- [ ] 选中物体后，点击 Generate
- [ ] 控制台显示 "Mask file size: X bytes, type: image/png"
- [ ] 编辑成功后显示 "✅ Edit completed successfully"
- [ ] 编辑结果符合预期（物体被精确修改）

**预期结果：**
```
📤 Generating edit with object: obj_1, prompt: "change to red"
Mask file size: 12345 bytes, type: image/png
✅ Edit completed successfully
```

---

## 关键阶段测试流程

### 阶段 1：上传与分割
1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 上传一张包含多个物体的图片
4. 观察日志输出，确认：
   - 分割成功
   - 物体数量正确
   - 掩码文件有效

### 阶段 2：物体选择
1. 鼠标悬停在图片上
2. 观察物体高亮效果
3. 点击一个物体
4. 检查控制台日志，确认选中正确

### 阶段 3：编辑生成
1. 输入编辑指令（如 "change to blue"）
2. 点击 Generate
3. 观察日志，确认：
   - 掩码文件正确传递
   - API 调用成功
   - 编辑结果添加到历史记录

### 阶段 4：边界情况
- [ ] 上传无法识别物体的图片（纯色背景）
- [ ] 点击物体边缘
- [ ] 快速连续点击多个物体
- [ ] 编辑后重新分割

---

## 常见问题排查

### 问题：分割失败
**检查：**
1. API Key 是否正确配置
2. 图片是否过大（应自动压缩到 1000px）
3. 查看 "Raw API response" 日志

### 问题：点击无响应
**检查：**
1. Canvas 尺寸是否与图片匹配
2. isActive 状态是否为 true
3. 物体 box 坐标是否正确

### 问题：编辑结果不精确
**检查：**
1. 掩码文件大小是否 > 0
2. 掩码文件类型是否为 image/png
3. 选中的物体是否正确

---

## 成功标准

✅ **所有测试点通过**
✅ **控制台无错误日志**
✅ **编辑结果精确匹配选中物体**
✅ **用户体验流畅自然**
