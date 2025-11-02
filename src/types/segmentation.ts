/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * 分割后的物体对象
 */
export interface SegmentObject {
  id: string;                              // 唯一标识
  box: [number, number, number, number];   // [ymin, xmin, ymax, xmax] 归一化坐标 (0-1000)
  mask: string;                            // base64 PNG 掩码
  maskFile: File;                          // 转换后的 File 对象
}

/**
 * 分割结果
 */
export interface SegmentationResult {
  objects: SegmentObject[];
  originalImage: File;
}
