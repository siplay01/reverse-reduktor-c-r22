// Cuts the main object out of a photo with macOS Vision (on-device, no upload) and puts it on a white canvas.
// Usage: swift scripts/cutout.swift <in.jpg> <out.png> [instances: all | largest | 1,2] [canvasW canvasH fill]
// With canvasW = 0: transparent PNG, object cropped at its original resolution (for designers).
// Prints the detected instances (index, area share) so the right ones can be chosen.
import AppKit
import CoreImage
import Vision

let a = CommandLine.arguments
guard a.count >= 3 else { print("usage: cutout in out [all|largest|i,j] [W H fill]"); exit(1) }
let pick = a.count > 3 ? a[3] : "all"
let W = a.count > 5 ? Double(a[4])! : 1600, H = a.count > 5 ? Double(a[5])! : 1200, fill = a.count > 6 ? Double(a[6])! : 0.86

let input = CIImage(contentsOf: URL(fileURLWithPath: a[1]), options: [.applyOrientationProperty: true])!
let handler = VNImageRequestHandler(ciImage: input)
let req = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([req])
guard let obs = req.results?.first else { print("no foreground found"); exit(2) }

// area share of each instance, to choose which to keep
let all = obs.allInstances
var shares: [(Int, Double)] = []
for i in all {
  let m = try obs.generateScaledMaskForImage(forInstances: IndexSet(integer: i), from: handler)
  let ci = CIImage(cvPixelBuffer: m)
  let avg = CIFilter(name: "CIAreaAverage", parameters: [kCIInputImageKey: ci, kCIInputExtentKey: CIVector(cgRect: ci.extent)])!.outputImage!
  var px = [Float](repeating: 0, count: 4)
  CIContext().render(avg, toBitmap: &px, rowBytes: 16, bounds: CGRect(x: 0, y: 0, width: 1, height: 1), format: .RGBAf, colorSpace: nil)
  shares.append((i, Double(px[0])))
  print("instance \(i): \(String(format: "%.1f", Double(px[0]) * 100))% of image")
}
var keep = IndexSet()
if pick == "all" { keep = all } else if pick == "largest" { keep.insert(shares.max { $0.1 < $1.1 }!.0) } else { pick.split(separator: ",").forEach { keep.insert(Int($0)!) } }

let mask = CIImage(cvPixelBuffer: try obs.generateScaledMaskForImage(forInstances: keep, from: handler))
let white = CIImage(color: .white).cropped(to: input.extent)
let comp = input.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: white, kCIInputMaskImageKey: mask])

// bounding box of the mask
let ctx = CIContext()
let mcg = ctx.createCGImage(mask, from: mask.extent)!
let w = mcg.width, h = mcg.height
var buf = [UInt8](repeating: 0, count: w * h)
let gctx = CGContext(data: &buf, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: 0)!
gctx.draw(mcg, in: CGRect(x: 0, y: 0, width: w, height: h))
var x0 = w, y0 = h, x1 = 0, y1 = 0
for y in 0..<h { for x in 0..<w where buf[y * w + x] > 128 { x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y) } }
// buf rows are top-down; CI coordinates are bottom-up
let box = CGRect(x: x0, y: h - 1 - y1, width: x1 - x0 + 1, height: y1 - y0 + 1)
let obj = comp.cropped(to: box).transformed(by: CGAffineTransform(translationX: -box.minX, y: -box.minY))
if W == 0 {
  let clear = CIImage(color: .clear).cropped(to: input.extent)
  let cut = input.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: clear, kCIInputMaskImageKey: mask]).cropped(to: box)
  let cg = ctx.createCGImage(cut, from: box, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB))!
  try NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[2]))
  print("transparent \(Int(box.width))x\(Int(box.height)) -> \(a[2])"); exit(0)
}
let s = min(W * fill / box.width, H * fill / box.height)
let placed = obj.transformed(by: CGAffineTransform(scaleX: s, y: s)).transformed(by: CGAffineTransform(translationX: (W - box.width * s) / 2, y: (H - box.height * s) / 2))
let canvas = placed.composited(over: CIImage(color: .white).cropped(to: CGRect(x: 0, y: 0, width: W, height: H)))
let out = ctx.createCGImage(canvas, from: CGRect(x: 0, y: 0, width: W, height: H))!
let rep = NSBitmapImageRep(cgImage: out)
try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[2]))
print("box \(Int(box.width))x\(Int(box.height)) scale \(String(format: "%.2f", s)) -> \(a[2])")
