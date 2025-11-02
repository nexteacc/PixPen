# 🎨 物体可视化高亮流程

## 整体架构

```
图片层（底层）
    ↓
Canvas 层（透明覆盖层）
    ↓
绘制物体边框和高亮
```

---

## 📊 数据流

### 1. 分割阶段
```typescript
上传图片
  ↓
segmentImage(file) // API 调用
  ↓
返回 SegmentObject[]
  ├─ id: "obj_0"
  ├─ box: [ymin, xmin, ymax, xmax]  // 归一化坐标 (0-1000)
  ├─ mask: "data:image/png;base64,..."
  └─ maskFile: File
```

### 2. 渲染阶段
```typescript
App.tsx
  ↓
<ObjectSelectCanvas
  imageRef={imgRef}           // 引用图片元素
  objects={segmentObjects}    // 所有物体数据
  selectedObject={selected}   // 当前选中的物体
  onSelectObject={setSelected}
  isActive={!isLoading}
/>
```

---

## 🎯 Canvas 层实现

### 层级结构
```html
<div className="relative">
  <!-- 底层：原图 -->
  <img ref={imgRef} src={originalImageUrl} />
  
  <!-- 中层：当前编辑图 -->
  <img src={currentImageUrl} className="absolute top-0 left-0" />
  
  <!-- 顶层：Canvas 交互层 -->
  <canvas 
    ref={canvasRef}
    className="absolute top-0 left-0 cursor-pointer"
  />
</div>
```

### Canvas 尺寸匹配
```typescript
const img = imageRef.current;
canvas.width = img.naturalWidth;   // 使用原始尺寸
canvas.height = img.naturalHeight;
```

**为什么用 naturalWidth？**
- 确保 Canvas 与图片像素完美对齐
- 避免缩放导致的坐标偏移

---

## 🖌️ 绘制逻辑

### 坐标转换
```typescript
// API 返回的是归一化坐标 (0-1000)
const [ymin, xmin, ymax, xmax] = obj.box;

// 转换为实际像素坐标
const x = (xmin / 1000) * canvas.width;
const y = (ymin / 1000) * canvas.height;
const width = ((xmax - xmin) / 1000) * canvas.width;
const height = ((ymax - ymin) / 1000) * canvas.height;
```

### 三种状态的可视化

#### 1️⃣ 未选中状态（默认）
```typescript
// 淡淡的白色虚线边框
ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
ctx.lineWidth = 1;
ctx.setLineDash([3, 3]);  // 虚线
ctx.strokeRect(x, y, width, height);
```
**效果：** 白色虚线边框，提示可点击

#### 2️⃣ 悬停状态（hover）
```typescript
// 淡蓝色半透明填充 + 蓝色虚线边框
ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
ctx.fillRect(x, y, width, height);

ctx.strokeStyle = '#3b82f6';
ctx.lineWidth = 2;
ctx.setLineDash([5, 5]);  // 虚线
ctx.strokeRect(x, y, width, height);
```
**效果：** 淡蓝色高亮 + 蓝色虚线边框

#### 3️⃣ 选中状态（selected）
```typescript
// 蓝色半透明填充 + 蓝色实线边框
ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
ctx.fillRect(x, y, width, height);

ctx.strokeStyle = '#3b82f6';
ctx.lineWidth = 3;
ctx.strokeRect(x, y, width, height);  // 实线
```
**效果：** 蓝色高亮 + 粗实线边框

---

## 🖱️ 交互检测

### 鼠标悬停检测
```typescript
handleMouseMove(e) {
  // 1. 获取鼠标在 Canvas 上的坐标
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  
  // 2. 检测是否在某个物体的 box 内
  const hoveredObject = objects.find(obj => {
    const [ymin, xmin, ymax, xmax] = obj.box;
    const boxX = (xmin / 1000) * canvas.width;
    const boxY = (ymin / 1000) * canvas.height;
    const boxW = ((xmax - xmin) / 1000) * canvas.width;
    const boxH = ((ymax - ymin) / 1000) * canvas.height;
    
    return x >= boxX && x <= boxX + boxW && 
           y >= boxY && y <= boxY + boxH;
  });
  
  // 3. 更新悬停状态
  setHoveredId(hoveredObject?.id || null);
}
```

### 点击选择检测
```typescript
handleClick(e) {
  // 同样的坐标转换和碰撞检测
  const clickedObject = objects.find(obj => {
    // ... 检测点击位置是否在 box 内
  });
  
  if (clickedObject) {
    onSelectObject(clickedObject);  // 通知父组件
  }
}
```

---

## 🔄 重绘触发

### useEffect 依赖
```typescript
useEffect(() => {
  // 重新绘制 Canvas
  drawAllObjects();
}, [
  objects,          // 物体列表变化
  selectedObject,   // 选中状态变化
  hoveredId,        // 悬停状态变化
  imageUrl,         // 图片变化
  isActive,         // 激活状态变化
  imageRef          // 图片引用变化
]);
```

### 绘制流程
```
1. 清空画布
   ctx.clearRect(0, 0, canvas.width, canvas.height)

2. 遍历所有物体
   objects.forEach(obj => {
     if (obj.id === selectedObject?.id) {
       drawObjectHighlight(ctx, obj, img, true, false)
     } else if (obj.id === hoveredId) {
       drawObjectHighlight(ctx, obj, img, false, true)
     } else {
       drawObjectBorder(ctx, obj, img)
     }
   })
```

---

## 🎭 视觉效果总结

| 状态 | 填充颜色 | 边框颜色 | 边框样式 | 边框宽度 |
|------|---------|---------|---------|---------|
| 未选中 | 无 | 白色 40% | 虚线 [3,3] | 1px |
| 悬停 | 蓝色 15% | 蓝色 100% | 虚线 [5,5] | 2px |
| 选中 | 蓝色 25% | 蓝色 100% | 实线 | 3px |

---

## 🔍 关键技术点

### 1. 坐标系统
- **API 返回：** 归一化坐标 (0-1000)
- **Canvas 使用：** 实际像素坐标
- **转换公式：** `pixel = (normalized / 1000) * imageSize`

### 2. 缩放处理
```typescript
// Canvas 显示尺寸 vs 实际尺寸
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;

// 鼠标坐标需要按比例转换
const canvasX = (mouseX - rect.left) * scaleX;
const canvasY = (mouseY - rect.top) * scaleY;
```

### 3. 性能优化
- 只在状态变化时重绘
- 使用 `clearRect` 而不是重新创建 Canvas
- 碰撞检测使用简单的矩形算法

---

## 🎯 用户体验流程

```
用户上传图片
  ↓
显示 "正在分析图片物体..."
  ↓
API 返回 13 个物体
  ↓
Canvas 绘制 13 个白色虚线边框
  ↓
用户鼠标悬停
  ↓
检测到悬停 → 物体变蓝色虚线高亮
  ↓
用户点击
  ↓
检测到点击 → 物体变蓝色实线高亮
  ↓
右侧显示编辑面板
  ↓
用户输入指令 → 生成编辑结果
```

---

## 🐛 调试技巧

### 控制台日志
```
Canvas size: 600x800, Image size: 600x800, Objects: 13
✅ Object selected: obj_1, box=[164,263,706,675]
❌ No object found at click position: (294, 348)
```

### 检查清单
- [ ] Canvas 尺寸是否与图片一致？
- [ ] 坐标转换是否正确？
- [ ] 物体 box 是否在 0-1000 范围内？
- [ ] isActive 状态是否为 true？
- [ ] 鼠标事件是否被正确捕获？
