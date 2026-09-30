// Splits the Cabbageland panorama into paper layers for the site.
// Reads scene.json. Geometry (what is cut, water, clouds, hit areas) is measured once on the geometry variant
// (day) and reused for every variant, so day and night pieces line up exactly. Writes, per variant,
// <out>/<variant>/base.jpg, front.png, clouds/*.png, pieces/*.png; shared masks in <out>/shared/; and layers.js.
// Coordinates in scene.json are in "units" whatever the source resolution; sources can be upscaled first.
// Usage: build-layers path/to/scene.json   (normally via ../rebuild.sh)

import CoreGraphics
import CoreImage
import Foundation
import ImageIO
import Metal
import MetalFX
import UniformTypeIdentifiers
import Vision

func fail(_ message: String) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(1)
}

// MARK: - scene

guard CommandLine.arguments.count >= 2 else { fail("usage: build-layers scene.json") }
let sceneURL = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL
let sceneDir = sceneURL.deletingLastPathComponent()
guard let sceneData = try? Data(contentsOf: sceneURL) else { fail("cannot read \(sceneURL.path)") }
let scene: [String: Any]
do {
  guard let obj = try JSONSerialization.jsonObject(with: sceneData) as? [String: Any] else { fail("scene.json must be a JSON object") }
  scene = obj
} catch { fail("scene.json is not valid JSON: \((error as NSError).userInfo[NSDebugDescriptionErrorKey] ?? error)") }

func num(_ v: Any?) -> Double { (v as? NSNumber)?.doubleValue ?? 0 }
func nums(_ v: Any?) -> [Double] { (v as? [Any])?.map(num) ?? [] }
func poly(_ v: Any?) -> [[Double]] { (v as? [Any])?.map(nums) ?? [] }
func polys(_ v: Any?) -> [[[Double]]] { (v as? [Any])?.map(poly) ?? [] }

let outDir = sceneDir.appendingPathComponent(scene["out"] as? String ?? "layers").standardizedFileURL
// the output folder is wiped on every build, so it must be a subfolder of the scene folder
guard outDir.path.hasPrefix(sceneDir.path + "/"), outDir.path.count > sceneDir.path.count + 1 else {
  fail("\"out\" must be a subfolder next to scene.json (got \(outDir.path))")
}
let variantDefs: [String: [String: Any]] = {
  if let v = scene["variants"] as? [String: [String: Any]], !v.isEmpty { return v }
  return ["day": ["source": scene["source"] as? String ?? ""]]
}()
let variantKeys = variantDefs.keys.sorted { a, b in a == "day" ? true : b == "day" ? false : a < b }
let geomKey = scene["geometry"] as? String ?? variantKeys[0]
func variantSource(_ key: String) -> String { variantDefs[key]?["source"] as? String ?? "" }
let units = scene["units"] != nil ? nums(scene["units"]) : [1536, 1024]
let upscale = max(1, Int(scene["upscale"] != nil ? num(scene["upscale"]) : 1))
let sharpen = scene["upscaleSharpen"] != nil ? num(scene["upscaleSharpen"]) : 0.35

// MARK: - image in (optionally upscaled)

let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
let ciContext = CIContext(options: [.workingColorSpace: srgb, .outputColorSpace: srgb])

// RGBA pixels, optionally resampled to w × h (extra sources can differ from the panorama by a pixel).
func rgbaBytes(_ img: CGImage, _ w0: Int? = nil, _ h0: Int? = nil) -> [UInt8] {
  let w = w0 ?? img.width, h = h0 ?? img.height
  var px = [UInt8](repeating: 0, count: w * h * 4)
  px.withUnsafeMutableBytes { buf in
    let ctx = CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                        space: srgb, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.interpolationQuality = .high
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
  }
  return px
}
func imageFrom(_ px: [UInt8], _ w: Int, _ h: Int) -> CGImage {
  CGImage(width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: w * 4, space: srgb,
          bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
          provider: CGDataProvider(data: Data(px) as CFData)!, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
}

// Edge-adaptive upscale with MetalFX (same family as FSR 1); Lanczos if MetalFX is unavailable.
func upscaleMetalFX(_ img: CGImage, _ f: Int) -> CGImage? {
  guard let device = MTLCreateSystemDefaultDevice(), let queue = device.makeCommandQueue(),
        MTLFXSpatialScalerDescriptor.supportsDevice(device) else { return nil }
  let w = img.width, h = img.height, ow = w * f, oh = h * f
  let d = MTLFXSpatialScalerDescriptor()
  d.inputWidth = w; d.inputHeight = h; d.outputWidth = ow; d.outputHeight = oh
  d.colorTextureFormat = .rgba8Unorm; d.outputTextureFormat = .rgba8Unorm; d.colorProcessingMode = .perceptual
  guard let scaler = d.makeSpatialScaler(device: device) else { return nil }
  let storage: MTLStorageMode = device.hasUnifiedMemory ? .shared : .managed
  let inDesc = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm, width: w, height: h, mipmapped: false)
  inDesc.usage = scaler.colorTextureUsage.union(.shaderRead); inDesc.storageMode = storage
  let outDesc = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm, width: ow, height: oh, mipmapped: false)
  outDesc.usage = scaler.outputTextureUsage; outDesc.storageMode = .private
  let readDesc = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm, width: ow, height: oh, mipmapped: false)
  readDesc.usage = .shaderRead; readDesc.storageMode = storage
  guard let inTex = device.makeTexture(descriptor: inDesc), let outTex = device.makeTexture(descriptor: outDesc),
        let readTex = device.makeTexture(descriptor: readDesc), let cb = queue.makeCommandBuffer() else { return nil }
  let bytes = rgbaBytes(img)
  bytes.withUnsafeBytes { inTex.replace(region: MTLRegionMake2D(0, 0, w, h), mipmapLevel: 0, withBytes: $0.baseAddress!, bytesPerRow: w * 4) }
  scaler.colorTexture = inTex; scaler.outputTexture = outTex
  scaler.inputContentWidth = w; scaler.inputContentHeight = h
  scaler.encode(commandBuffer: cb)
  guard let blit = cb.makeBlitCommandEncoder() else { return nil }
  blit.copy(from: outTex, to: readTex)
  if storage == .managed { blit.synchronize(resource: readTex) }
  blit.endEncoding()
  cb.commit(); cb.waitUntilCompleted()
  if cb.status != .completed { return nil }
  var out = [UInt8](repeating: 0, count: ow * oh * 4)
  out.withUnsafeMutableBytes { readTex.getBytes($0.baseAddress!, bytesPerRow: ow * 4, from: MTLRegionMake2D(0, 0, ow, oh), mipmapLevel: 0) }
  for i in 0..<(ow * oh) { out[4 * i + 3] = 255 }
  return imageFrom(out, ow, oh)
}
func upscaleLanczos(_ img: CGImage, _ f: Int) -> CGImage {
  let filter = CIFilter(name: "CILanczosScaleTransform")!
  filter.setValue(CIImage(cgImage: img), forKey: kCIInputImageKey)
  filter.setValue(Double(f), forKey: kCIInputScaleKey)
  filter.setValue(1.0, forKey: kCIInputAspectRatioKey)
  let out = filter.outputImage!
  return ciContext.createCGImage(out, from: CGRect(x: 0, y: 0, width: img.width * f, height: img.height * f))!
}
func sharpened(_ img: CGImage, _ amount: Double) -> CGImage {
  guard amount > 0, let filter = CIFilter(name: "CISharpenLuminance") else { return img }
  filter.setValue(CIImage(cgImage: img), forKey: kCIInputImageKey)
  filter.setValue(amount, forKey: kCIInputSharpnessKey)
  filter.setValue(1.2, forKey: kCIInputRadiusKey)
  return ciContext.createCGImage(filter.outputImage!, from: CGRect(x: 0, y: 0, width: img.width, height: img.height)) ?? img
}

func loadImage(_ rel: String) -> CGImage {
  let url = sceneDir.appendingPathComponent(rel).standardizedFileURL
  guard let isrc = CGImageSourceCreateWithURL(url as CFURL, nil), let img = CGImageSourceCreateImageAtIndex(isrc, 0, nil)
  else { fail("cannot read source image \(url.path)") }
  return img
}
// An AI-upscaled copy in source/hd/ (world/tools/upscale-sources.sh) is used when present. A little of the plain
// upscale is mixed back in (hdMix) so the original paper grain survives the network's smoothing.
let hdMix = scene["hdMix"] != nil ? num(scene["hdMix"]) : 0.18
func prepared(_ rel: String) -> CGImage {
  var img = loadImage(rel)
  if upscale > 1 {
    if let up = upscaleMetalFX(img, upscale) { img = up } else { img = upscaleLanczos(img, upscale); print("  (Lanczos upscale)") }
    img = sharpened(img, sharpen)
  }
  let hdRel = (rel as NSString).deletingLastPathComponent + "/hd/" + (rel as NSString).lastPathComponent
  if upscale > 1, FileManager.default.fileExists(atPath: sceneDir.appendingPathComponent(hdRel).path) {
    let hd = loadImage(hdRel), w = img.width, h = img.height
    var px = [UInt8](repeating: 0, count: w * h * 4)
    px.withUnsafeMutableBytes { buf in
      let ctx = CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                          space: srgb, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
      ctx.interpolationQuality = .high
      ctx.draw(hd, in: CGRect(x: 0, y: 0, width: w, height: h))
      ctx.setAlpha(CGFloat(hdMix)); ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    }
    print("  \(hdRel) (AI upscale, \(Int(hdMix * 100))% plain mixed in)")
    img = imageFrom(px, w, h)
  }
  return img
}
let geomImage = prepared(variantSource(geomKey))
let W = geomImage.width, H = geomImage.height, N = W * H
let K = Double(W) / units[0]  // layer pixels per scene unit
let src = rgbaBytes(geomImage)  // geometry pixels
print("geometry \(variantSource(geomKey)) → layers \(W)×\(H) (\(K)× units), variants: \(variantKeys.joined(separator: ", "))")
var extras: [String: [UInt8]] = [:]
for (name, rel) in (scene["extraSources"] as? [String: String]) ?? [:] { extras[name] = rgbaBytes(prepared(rel), W, H) }

// MARK: - helpers

@inline(__always) func sstep(_ a: Float, _ b: Float, _ v: Float) -> Float {
  let x = max(0, min(1, (v - a) / (b - a)))
  return x * x * (3 - 2 * x)
}
func px(_ v: Double) -> Int { Int((v * K).rounded()) }
func rad(_ r: Double) -> Int { max(1, Int((r * K).rounded())) }

func polyMask(_ shapes: [[[Double]]]) -> [Float] {
  var m = [UInt8](repeating: 0, count: N)
  m.withUnsafeMutableBytes { buf in
    let ctx = CGContext(data: buf.baseAddress, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W,
                        space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
    ctx.translateBy(x: 0, y: CGFloat(H))
    ctx.scaleBy(x: CGFloat(K), y: -CGFloat(K))
    ctx.setFillColor(gray: 1, alpha: 1)
    for shape in shapes where shape.count >= 3 {
      ctx.beginPath()
      ctx.move(to: CGPoint(x: shape[0][0], y: shape[0][1]))
      for p in shape.dropFirst() { ctx.addLine(to: CGPoint(x: p[0], y: p[1])) }
      ctx.closePath()
      ctx.fillPath()
    }
  }
  return m.map { Float($0) / 255 }
}

// Max filter with a square window, optionally limited to a rectangle (layer pixels) for speed.
func dilate(_ m: [Float], _ r: Int, rect: (Int, Int, Int, Int)? = nil) -> [Float] {
  let (x0, y0, x1, y1): (Int, Int, Int, Int) = {
    guard let rc = rect else { return (0, 0, W - 1, H - 1) }
    return (max(0, rc.0 - r), max(0, rc.1 - r), min(W - 1, rc.0 + rc.2 + r), min(H - 1, rc.1 + rc.3 + r))
  }()
  var tmp = m, out = m
  for y in y0...y1 {
    for x in x0...x1 {
      var v: Float = 0
      for k in max(x0, x - r)...min(x1, x + r) { v = max(v, m[y * W + k]) }
      tmp[y * W + x] = v
    }
  }
  for y in y0...y1 {
    for x in x0...x1 {
      var v: Float = 0
      for k in max(y0, y - r)...min(y1, y + r) { v = max(v, tmp[k * W + x]) }
      out[y * W + x] = v
    }
  }
  return out
}

// Push-pull fill: colours where weight is 0 are filled smoothly from their surroundings.
func pushPull(_ rgb: [Float], _ weight: [Float]) -> [Float] {
  struct Level { var w: Int; var h: Int; var c: [Float]; var a: [Float] }
  var levels: [Level] = []
  var c = [Float](repeating: 0, count: 3 * N), a = [Float](repeating: 0, count: N)
  for i in 0..<N {
    let wt = min(1, weight[i]); a[i] = wt
    c[3 * i] = rgb[3 * i] * wt; c[3 * i + 1] = rgb[3 * i + 1] * wt; c[3 * i + 2] = rgb[3 * i + 2] * wt
  }
  levels.append(Level(w: W, h: H, c: c, a: a))
  var w = W, h = H
  while w > 1 || h > 1 {
    let nw = max(1, (w + 1) / 2), nh = max(1, (h + 1) / 2)
    var nc = [Float](repeating: 0, count: 3 * nw * nh), na = [Float](repeating: 0, count: nw * nh)
    let prev = levels[levels.count - 1]
    for y in 0..<nh {
      for x in 0..<nw {
        var sa: Float = 0, sr: Float = 0, sg: Float = 0, sb: Float = 0
        for dy in 0..<2 {
          for dx in 0..<2 {
            let j = min(h - 1, 2 * y + dy) * w + min(w - 1, 2 * x + dx)
            sa += prev.a[j]; sr += prev.c[3 * j]; sg += prev.c[3 * j + 1]; sb += prev.c[3 * j + 2]
          }
        }
        if sa > 1 { sr /= sa; sg /= sa; sb /= sa; sa = 1 }
        let k = y * nw + x
        na[k] = sa; nc[3 * k] = sr; nc[3 * k + 1] = sg; nc[3 * k + 2] = sb
      }
    }
    w = nw; h = nh
    levels.append(Level(w: w, h: h, c: nc, a: na))
  }
  let top = levels[levels.count - 1]
  let ta = top.a[0] > 0 ? top.a[0] : 1
  var f = [top.c[0] / ta, top.c[1] / ta, top.c[2] / ta]
  var fw = 1, fh = 1
  for l in stride(from: levels.count - 2, through: 0, by: -1) {
    let lv = levels[l]
    var nf = [Float](repeating: 0, count: 3 * lv.w * lv.h)
    for y in 0..<lv.h {
      for x in 0..<lv.w {
        let k = y * lv.w + x, al = lv.a[k]
        let fx = min(Float(fw - 1), max(0, (Float(x) + 0.5) / 2 - 0.5)), fy = min(Float(fh - 1), max(0, (Float(y) + 0.5) / 2 - 0.5))
        let ix = Int(fx), iy = Int(fy), ix1 = min(fw - 1, ix + 1), iy1 = min(fh - 1, iy + 1)
        let tx = fx - Float(ix), ty = fy - Float(iy)
        for ch in 0..<3 {
          let u = (f[3 * (iy * fw + ix) + ch] * (1 - tx) + f[3 * (iy * fw + ix1) + ch] * tx) * (1 - ty)
                + (f[3 * (iy1 * fw + ix) + ch] * (1 - tx) + f[3 * (iy1 * fw + ix1) + ch] * tx) * ty
          nf[3 * k + ch] = lv.c[3 * k + ch] + (1 - al) * u
        }
      }
    }
    f = nf; fw = lv.w; fh = lv.h
  }
  return f
}

// Soft edge pixels take their colour from the solid interior, so no background is baked into an edge.
func bleed(_ p: inout [UInt8], _ w: Int, _ h: Int, iterations: Int) {
  var solid = [Bool](repeating: false, count: w * h)
  for i in 0..<(w * h) {
    let a = Float(p[4 * i + 3]) / 255
    p[4 * i + 3] = UInt8(max(0, min(1, (a - 0.12) / 0.7)) * 255 + 0.5)
    solid[i] = a >= 0.9
  }
  for _ in 0..<iterations {
    var next = solid
    for y in 0..<h {
      for x in 0..<w {
        let i = y * w + x
        if solid[i] || p[4 * i + 3] == 0 { continue }
        var r = 0, g = 0, b = 0, n = 0
        for dy in -1...1 {
          for dx in -1...1 {
            let xx = x + dx, yy = y + dy
            if xx < 0 || yy < 0 || xx >= w || yy >= h { continue }
            let j = yy * w + xx
            if !solid[j] { continue }
            r += Int(p[4 * j]); g += Int(p[4 * j + 1]); b += Int(p[4 * j + 2]); n += 1
          }
        }
        if n > 0 { p[4 * i] = UInt8(r / n); p[4 * i + 1] = UInt8(g / n); p[4 * i + 2] = UInt8(b / n); next[i] = true }
      }
    }
    solid = next
  }
}

func writeImage(_ rgba: [UInt8], _ w: Int, _ h: Int, _ url: URL, jpegQuality: Double? = nil) {
  try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
  let info = jpegQuality != nil ? CGImageAlphaInfo.noneSkipLast : CGImageAlphaInfo.last
  guard let img = CGImage(width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: w * 4, space: srgb,
                          bitmapInfo: CGBitmapInfo(rawValue: info.rawValue), provider: CGDataProvider(data: Data(rgba) as CFData)!,
                          decode: nil, shouldInterpolate: false, intent: .defaultIntent),
        let dest = CGImageDestinationCreateWithURL(url as CFURL, (jpegQuality != nil ? UTType.jpeg : UTType.png).identifier as CFString, 1, nil)
  else { fail("cannot write \(url.path)") }
  let props: [CFString: Any] = jpegQuality != nil ? [kCGImageDestinationLossyCompressionQuality: jpegQuality!] : [:]
  CGImageDestinationAddImage(dest, img, props as CFDictionary)
  if !CGImageDestinationFinalize(dest) { fail("cannot write \(url.path)") }
}

// Vision "lift subject" inside a crop (scene units); keeps the largest subject found there.
var visionCache: [String: [Float]] = [:]
func subjectMask(_ r: [Double]) -> [Float] {
  let key = r.map { String(Int($0)) }.joined(separator: ",")
  if let m = visionCache[key] { return m }
  let x0 = px(r[0]), y0 = px(r[1]), cw = px(r[2]), ch = px(r[3])
  guard let crop = geomImage.cropping(to: CGRect(x: x0, y: y0, width: cw, height: ch)) else { fail("bad subject crop \(key)") }
  let handler = VNImageRequestHandler(cgImage: crop)
  let request = VNGenerateForegroundInstanceMaskRequest()
  var full = [Float](repeating: 0, count: N)
  do { try handler.perform([request]) } catch { fail("Vision failed on \(key): \(error)") }
  guard let obs = request.results?.first, !obs.allInstances.isEmpty else {
    print("  warning: no subject found in crop [\(key)]")
    visionCache[key] = full
    return full
  }
  var best: [Float] = [], bestCount = -1
  for inst in obs.allInstances {
    guard let buf = try? obs.generateScaledMaskForImage(forInstances: IndexSet(integer: inst), from: handler) else { continue }
    let ci = CIImage(cvPixelBuffer: buf)
    var gray = [UInt8](repeating: 0, count: cw * ch)
    gray.withUnsafeMutableBytes { b in
      let ctx = CGContext(data: b.baseAddress, width: cw, height: ch, bitsPerComponent: 8, bytesPerRow: cw,
                          space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
      if let mcg = ciContext.createCGImage(ci, from: ci.extent) { ctx.draw(mcg, in: CGRect(x: 0, y: 0, width: cw, height: ch)) }
    }
    let count = gray.reduce(0) { $0 + ($1 > 127 ? 1 : 0) }
    if count > bestCount { bestCount = count; best = gray.map { Float($0) / 255 } }
  }
  for y in 0..<ch { for x in 0..<cw where y0 + y < H && x0 + x < W { full[(y0 + y) * W + x0 + x] = best[y * cw + x] } }
  if obs.allInstances.count > 1 { print("  note: \(obs.allInstances.count) subjects in [\(key)], kept the largest") }
  visionCache[key] = full
  return full
}

// MARK: - classify sky and paper clouds

var sky = [Float](repeating: 0, count: N), cloud = [Float](repeating: 0, count: N)
for i in 0..<N {
  let r = Float(src[4 * i]), g = Float(src[4 * i + 1]), b = Float(src[4 * i + 2])
  let mx = max(r, g, b), mn = min(r, g, b)
  sky[i] = sstep(30, 50, b - r) * sstep(195, 215, b) * sstep(150, 165, g)
  cloud[i] = sstep(50, 34, mx - mn) * sstep(150, 172, mn)
}
let exclude = polyMask(polys(scene["cloudExclude"]))

// MARK: - pieces (assigned front-most first, so every pixel belongs to one piece)

let pieceDefs = (scene["pieces"] as? [[String: Any]]) ?? []
var pieceMasks = [String: [Float]]()
var taken = [Float](repeating: 0, count: N)
var holes = [Float](repeating: 0, count: N)  // where the base is refilled (pieces with keepUnder leave the art in place)
var skyHoles = [Float](repeating: 0, count: N)  // holes refilled from open sky only (cut.fill = "sky"), e.g. tree tops
for def in pieceDefs.reversed() {
  let id = def["id"] as? String ?? "?"
  let cut = def["cut"] as? [String: Any] ?? [:]
  var m: [Float]
  if cut["subject"] != nil {
    m = subjectMask(nums(cut["subject"]))
    if cut["within"] != nil { let p = polyMask([poly(cut["within"])]); for i in 0..<N { m[i] *= p[i] } }
    if cut["minus"] != nil { let p = polyMask([poly(cut["minus"])]); for i in 0..<N { m[i] *= 1 - p[i] } }
  } else if cut["polygon"] != nil {
    var shape = poly(cut["polygon"])
    let k = cut["widen"] != nil ? num(cut["widen"]) : 1
    if k != 1 { let cx = shape.map { $0[0] }.reduce(0, +) / Double(shape.count); shape = shape.map { [cx + ($0[0] - cx) * k, $0[1]] } }
    m = polyMask([shape])
    if (cut["dropSky"] as? Bool) == true { for i in 0..<N { m[i] *= (1 - sky[i]) * (1 - cloud[i]) } }
  } else { fail("piece \(id) needs cut.subject or cut.polygon") }
  if cut["maxY"] != nil { let my = min(H - 1, px(num(cut["maxY"]))); for y in (my + 1)..<H { for x in 0..<W { m[y * W + x] = 0 } } }
  // below this line keep only green paper (leaves hanging over a cliff), not the water or rock the subject grabbed
  if cut["leavesBelow"] != nil {
    let y0 = max(0, px(num(cut["leavesBelow"])))
    var leaf = m
    for y in y0..<H {
      for x in 0..<W {
        let i = y * W + x
        if m[i] == 0 { continue }
        let r = Float(src[4 * i]), g = Float(src[4 * i + 1]), b = Float(src[4 * i + 2])
        leaf[i] = m[i] * sstep(4, 22, g - max(0.93 * r, b))
      }
    }
    // tidy: drop specks, then close small gaps inside leaves
    let band = (0, y0, W, H - y0), inv = { (a: [Float]) in a.map { 1 - $0 } }
    leaf = dilate(inv(dilate(inv(leaf), 2, rect: band)), 2, rect: band)
    leaf = inv(dilate(inv(dilate(leaf, 2, rect: band)), 2, rect: band))
    for y in y0..<H { for x in 0..<W { let i = y * W + x; m[i] = min(m[i], leaf[i]) } }
  }
  let keep = (def["keepUnder"] as? Bool) == true
  let skyFill = (cut["fill"] as? String) == "sky"
  for i in 0..<N {
    m[i] = min(m[i], 1 - taken[i]); taken[i] = min(1, taken[i] + m[i])
    if !keep { holes[i] = min(1, holes[i] + m[i]) }
    if skyFill { skyHoles[i] = min(1, skyHoles[i] + m[i]) }
  }
  pieceMasks[id] = m
}

// MARK: - clouds

let cloudDefs = (scene["clouds"] as? [[String: Any]]) ?? []
func rectPx(_ v: Any?) -> (Int, Int, Int, Int) { let r = nums(v); return (px(r[0]), px(r[1]), px(r[2]), px(r[3])) }
var cloudMasks = [String: [Float]]()
var cloudAll = [Float](repeating: 0, count: N)
for def in cloudDefs {
  let id = def["id"] as? String ?? "?"
  let r = rectPx(def["rect"])
  var m = [Float](repeating: 0, count: N)
  for y in max(0, r.1)..<min(H, r.1 + r.3) {
    for x in max(0, r.0)..<min(W, r.0 + r.2) { let i = y * W + x; m[i] = cloud[i] * (1 - exclude[i]) * (1 - taken[i]) }
  }
  for i in 0..<N { cloudAll[i] = max(cloudAll[i], m[i]) }
  cloudMasks[id] = m
}

// MARK: - shared geometry

let cloudHole = dilate(cloudAll.map { $0 > 0.04 ? 1 : 0 }, rad(2))
let pieceHole = dilate(holes.map { $0 > 0.04 ? 1 : 0 }, rad(2))
let skyHole = dilate(skyHoles.map { $0 > 0.04 ? 1 : 0 }, rad(2))
// sky fill only where open sky is close by; next to other things the hole takes its surroundings' colour
let nearSky = dilate(sky.enumerated().map { $0.element > 0.5 && pieceHole[$0.offset] == 0 ? 1 : 0 }, rad(10))

// hidden part of each cloud (behind trees), by morphological closing: fills where things cut into the cloud
struct CloudGeo { let id: String; let rect: (Int, Int, Int, Int); let mask: [Float]; let ext: [Bool]; let def: [String: Any] }
var cloudGeos: [CloudGeo] = []
for def in cloudDefs {
  let id = def["id"] as? String ?? "?"
  let m = cloudMasks[id]!, r = rectPx(def["rect"])
  let grown = dilate(m.map { $0 > 0.3 ? 1 : 0 }, rad(16), rect: r)
  let closed = dilate(grown.map { 1 - $0 }, rad(16), rect: r).map { 1 - $0 }
  var ext = [Bool](repeating: false, count: N)
  for y in max(0, r.1)..<min(H, r.1 + r.3) {
    for x in max(0, r.0)..<min(W, r.0 + r.2) {
      let i = y * W + x
      if closed[i] > 0.5 && sky[i] < 0.5 && m[i] < 0.6 && exclude[i] < 0.5 { ext[i] = true }
    }
  }
  cloudGeos.append(CloudGeo(id: id, rect: r, mask: m, ext: ext, def: def))
}

// MARK: - output helpers

try? FileManager.default.removeItem(at: outDir)
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
let bleedIterations = max(4, Int((4 * K).rounded()))
func units(_ v: Int) -> Double { (Double(v) / K * 1000).rounded() / 1000 }

func cropOut(_ mask: [Float], pixels: [UInt8], colors: [Float]? = nil, ext: [Bool]? = nil, tint: [Double]? = nil, to url: URL) -> [String: Any] {
  var x0 = W, y0 = H, x1 = -1, y1 = -1
  for y in 0..<H { for x in 0..<W where mask[y * W + x] > 0.02 { x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y) } }
  if x1 < 0 { print("  warning: \(url.lastPathComponent) is empty"); return ["x": 0, "y": 0, "w": 0, "h": 0] }
  let pad = rad(2)
  x0 = max(0, x0 - pad); y0 = max(0, y0 - pad); x1 = min(W - 1, x1 + pad); y1 = min(H - 1, y1 + pad)
  let w = x1 - x0 + 1, h = y1 - y0 + 1
  var p = [UInt8](repeating: 0, count: 4 * w * h)
  for y in 0..<h {
    for x in 0..<w {
      let i = (y0 + y) * W + x0 + x, j = y * w + x
      let useExt = ext?[i] ?? false
      for c in 0..<3 {
        var v = useExt ? Double(colors![3 * i + c]) : Double(pixels[4 * i + c])
        if let t = tint { v *= t[c] }
        p[4 * j + c] = UInt8(max(0, min(255, v.rounded())))
      }
      p[4 * j + 3] = UInt8(min(1, mask[i]) * 255 + 0.5)
    }
  }
  bleed(&p, w, h, iterations: bleedIterations)
  writeImage(p, w, h, url)
  return ["x": units(x0), "y": units(y0), "w": units(w), "h": units(h)]
}

// MARK: - per variant: base, front, clouds, pieces

var outClouds: [[String: Any]] = []
var outPieces: [[String: Any]] = []
var staticClouds: [String] = []
for key in variantKeys {
  let vpx = key == geomKey ? src : rgbaBytes(prepared(variantSource(key)), W, H)
  let tintList = nums(variantDefs[key]?["fromTint"])
  let tint: [Double]? = tintList.count == 3 ? tintList : nil
  let vdir = outDir.appendingPathComponent(key)
  let first = key == variantKeys[0]
  // "clouds": false keeps this variant's clouds painted into the base (its art may not line up with the clouds measured on the geometry variant)
  let movingClouds = (variantDefs[key]?["clouds"] as? Bool) ?? true
  if !movingClouds { staticClouds.append(key) }
  print("variant \(key)\(movingClouds ? "" : " (clouds stay painted)")")

  var rgb = [Float](repeating: 0, count: 3 * N)
  for i in 0..<N { rgb[3 * i] = Float(vpx[4 * i]); rgb[3 * i + 1] = Float(vpx[4 * i + 1]); rgb[3 * i + 2] = Float(vpx[4 * i + 2]) }
  var wA = [Float](repeating: 0, count: N)
  for i in 0..<N { wA[i] = sky[i] * (1 - cloudHole[i]) }
  let fillA = pushPull(rgb, wA)
  if movingClouds { for i in 0..<N where cloudHole[i] > 0 { let k = cloudHole[i]; for c in 0..<3 { rgb[3 * i + c] = rgb[3 * i + c] * (1 - k) + fillA[3 * i + c] * k } } }
  let fillB = pushPull(rgb, pieceHole.map { 1 - $0 })
  var wC = [Float](repeating: 0, count: N)
  for i in 0..<N { wC[i] = sky[i] * (1 - pieceHole[i]) }
  let fillC = pushPull(rgb, wC)
  for i in 0..<N where pieceHole[i] > 0 {
    let fill = skyHole[i] > 0 && nearSky[i] > 0 ? fillC : fillB
    for c in 0..<3 { rgb[3 * i + c] = fill[3 * i + c] }
  }
  var baseRGBA = [UInt8](repeating: 255, count: 4 * N)
  for i in 0..<N { for c in 0..<3 { baseRGBA[4 * i + c] = UInt8(max(0, min(255, rgb[3 * i + c].rounded()))) } }
  writeImage(baseRGBA, W, H, vdir.appendingPathComponent("base.jpg"), jpegQuality: 0.9)

  // things standing in front of the clouds, redrawn over the sliding clouds
  if movingClouds {
  var frontRGBA = [UInt8](repeating: 0, count: 4 * N)
  for g in cloudGeos {
    let r = g.rect
    for y in max(0, r.1)..<min(H, r.1 + r.3) {
      for x in max(0, r.0)..<min(W, r.0 + r.2) {
        let i = y * W + x
        let a = (1 - cloud[i]) * (1 - sky[i]) * (1 - min(1, pieceHole[i] + taken[i]))
        if a <= 0.02 { continue }
        for c in 0..<3 { frontRGBA[4 * i + c] = baseRGBA[4 * i + c] }
        frontRGBA[4 * i + 3] = max(frontRGBA[4 * i + 3], UInt8(a * 255))
      }
    }
  }
  bleed(&frontRGBA, W, H, iterations: bleedIterations)
  writeImage(frontRGBA, W, H, vdir.appendingPathComponent("front.png"))

  for g in cloudGeos {
    var info = cropOut(g.mask, pixels: vpx, to: vdir.appendingPathComponent("clouds/\(g.id).png"))
    if g.ext.contains(true) {
      var wt = [Float](repeating: 0, count: N), cr = [Float](repeating: 0, count: 3 * N)
      for i in 0..<N { wt[i] = g.mask[i] > 0.6 ? 1 : 0; for c in 0..<3 { cr[3 * i + c] = Float(vpx[4 * i + c]) } }
      let fill = pushPull(cr, wt)
      var colors = [Float](repeating: 0, count: 3 * N)
      for i in 0..<N where g.ext[i] { let k = 1 - g.mask[i]; for c in 0..<3 { colors[3 * i + c] = Float(vpx[4 * i + c]) * (1 - k) + fill[3 * i + c] * k } }
      var extInfo = cropOut(g.ext.map { $0 ? 1 : 0 }, pixels: vpx, colors: colors, ext: g.ext, to: vdir.appendingPathComponent("clouds/\(g.id)-behind.png"))
      extInfo["file"] = "clouds/\(g.id)-behind.png"
      info["behind"] = extInfo
    }
    if first {
      info["id"] = g.id; info["file"] = "clouds/\(g.id).png"
      for k in ["amp", "phase", "track"] { if let v = g.def[k] { info[k] = v } }
      outClouds.append(info)
    }
  }
  }

  for def in pieceDefs {
    let id = def["id"] as? String ?? "?"
    let cut = def["cut"] as? [String: Any] ?? [:]
    let from = cut["from"] as? String
    if let f = from, extras[f] == nil { fail("piece \(id): unknown extra source \(f)") }
    var info = cropOut(pieceMasks[id]!, pixels: from != nil ? extras[from!]! : vpx, tint: from != nil ? tint : nil,
                       to: vdir.appendingPathComponent("pieces/\(id).png"))
    if first {
      info["id"] = id; info["file"] = "pieces/\(id).png"
      for k in ["kind", "pivot", "parent", "spot", "kick"] { if let v = def[k] { info[k] = v } }
      outPieces.append(info)
    }
  }
}
print("pieces \(outPieces.count), clouds \(outClouds.count)")

// MARK: - shared: cloud occluders, water, hit map

let sharedDir = outDir.appendingPathComponent("shared")
// where something stood in front of the clouds in the original: hidden cloud may show only here
var occRGBA = [UInt8](repeating: 0, count: 4 * N)
for g in cloudGeos {
  let r = g.rect
  for y in max(0, r.1)..<min(H, r.1 + r.3) {
    for x in max(0, r.0)..<min(W, r.0 + r.2) {
      let i = y * W + x
      occRGBA[4 * i] = 255; occRGBA[4 * i + 1] = 255; occRGBA[4 * i + 2] = 255
      occRGBA[4 * i + 3] = max(occRGBA[4 * i + 3], UInt8((1 - cloud[i]) * (1 - sky[i]) * 255))
    }
  }
}
writeImage(occRGBA, W, H, sharedDir.appendingPathComponent("cloud-occluders.png"))

// open sky of the geometry variant (not clouds, not anything cut out): drifting paper clouds may show only here
var skyRGBA = [UInt8](repeating: 255, count: 4 * N)
for i in 0..<N { skyRGBA[4 * i + 3] = UInt8(max(0, min(1, sky[i] * (1 - cloud[i]) * (1 - taken[i]))) * 255) }
writeImage(skyRGBA, W, H, sharedDir.appendingPathComponent("sky.png"))

var outWater: [[String: Any]] = []
var claimed = [Float](repeating: 0, count: N)  // earlier water entries win where zones overlap (list the falls first)
for def in (scene["water"] as? [[String: Any]]) ?? [] where def["zones"] != nil {
  let id = def["id"] as? String ?? "?"
  var zone = polyMask(polys(def["zones"]))
  for i in 0..<N { let z = zone[i]; zone[i] = z * (1 - claimed[i]); claimed[i] = max(claimed[i], z) }
  var p = [UInt8](repeating: 0, count: 4 * N)
  var bx0 = W, by0 = H, bx1 = -1, by1 = -1, cover = 0
  for y in 0..<H {
    for x in 0..<W {
      let i = y * W + x
      let r = Float(src[4 * i]), b = Float(src[4 * i + 2])
      let wet = zone[i] * sstep(28, 50, b - r) * sstep(158, 198, b) * (1 - taken[i])
      p[4 * i] = 255; p[4 * i + 1] = 255; p[4 * i + 2] = 255; p[4 * i + 3] = UInt8(wet * 255)
      if wet > 0.1 { cover += 1; bx0 = min(bx0, x); bx1 = max(bx1, x); by0 = min(by0, y); by1 = max(by1, y) }
    }
  }
  writeImage(p, W, H, sharedDir.appendingPathComponent("water-\(id).png"))
  let box: [Double] = cover > 0 ? [units(bx0), units(by0), units(bx1 - bx0 + 1), units(by1 - by0 + 1)] : [0, 0, 0, 0]
  var info: [String: Any] = ["id": id, "file": "shared/water-\(id).png", "box": box]
  for k in ["type", "tile", "flow", "tileRot", "step", "speed", "density", "size", "angle", "alpha", "sheets"] { if let v = def[k] { info[k] = v } }
  outWater.append(info)
  print("water \(id): \(cover) px")
}

// hit map (2 units per cell): which place, or which pokeable piece, is under each point; front-most wins
let cell = 2.0
let hw = Int((units[0] / cell).rounded(.up)), hh = Int((units[1] / cell).rounded(.up))
var hit = [Int](repeating: 0, count: hw * hh)
var hitIds: [String] = [""]
for def in pieceDefs {
  let id = def["id"] as? String ?? "?"
  guard let target = (def["spot"] as? String) ?? ((def["kick"] as? Bool) == true ? id : nil) else { continue }
  var idx = hitIds.firstIndex(of: target) ?? -1
  if idx < 0 { hitIds.append(target); idx = hitIds.count - 1 }
  let m = pieceMasks[id]!
  var cells: [Int] = []
  for cy in 0..<hh {
    for cx in 0..<hw {
      let x = min(W - 1, Int((Double(cx) + 0.5) * cell * K)), y = min(H - 1, Int((Double(cy) + 0.5) * cell * K))
      if m[y * W + x] > 0.4 { cells.append(cy * hw + cx) }
    }
  }
  var grow = Set(cells)
  for c in cells { let cx = c % hw, cy = c / hw; for (dx, dy) in [(-1, 0), (1, 0), (0, -1), (0, 1)] { let nx = cx + dx, ny = cy + dy; if nx >= 0, ny >= 0, nx < hw, ny < hh { grow.insert(ny * hw + nx) } } }
  for c in grow { hit[c] = idx }
}
var rle: [Int] = []
var run = 0, last = hit[0]
for v in hit { if v == last { run += 1 } else { rle.append(last); rle.append(run); last = v; run = 1 } }
rle.append(last); rle.append(run)
print("hit map \(hw)×\(hh), \(hitIds.count - 1) targets, \(rle.count / 2) runs")

// Paths in scene.json are relative to scene.json; the page resolves them against the layers folder.
func relativeToOut(_ rel: String) -> String {
  let target = sceneDir.appendingPathComponent(rel).standardizedFileURL.pathComponents
  let base = outDir.pathComponents
  var i = 0
  while i < min(target.count, base.count), target[i] == base[i] { i += 1 }
  return (Array(repeating: "..", count: base.count - i) + target[i...]).joined(separator: "/")
}
var companion: Any = NSNull()
if var c = scene["companion"] as? [String: Any] {
  if let img = c["image"] as? String { c["image"] = relativeToOut(img) }
  companion = c
}
let layers: [String: Any] = [
  "size": units, "pixels": [W, H], "scale": K,
  "variants": variantKeys, "base": "base.jpg", "front": "front.png", "cloudOccluders": "shared/cloud-occluders.png", "sky": "shared/sky.png", "staticClouds": staticClouds,
  "clouds": outClouds, "pieces": outPieces, "water": outWater,
  "hitmap": ["w": hw, "h": hh, "cell": cell, "ids": hitIds, "rle": rle],
  "emitters": scene["emitters"] ?? [], "companion": companion, "spots": scene["spots"] ?? [],
  "style": scene["style"] ?? [:], "motions": scene["motions"] ?? [:],
]
let json = try! JSONSerialization.data(withJSONObject: layers, options: [.sortedKeys])
let js = "// Generated by world/tools/build-layers.swift from world/scene.json. Do not edit; run world/rebuild.sh instead.\nwindow.CABBAGE_LAYERS = "
  + String(data: json, encoding: .utf8)! + ";\n"
try! js.write(to: outDir.appendingPathComponent("layers.js"), atomically: true, encoding: .utf8)
print("wrote \(outDir.path)")
