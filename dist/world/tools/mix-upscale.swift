// mix-upscale <ai-upscaled> <original> <out.png> <width> [mix]
// Resizes the AI upscale to <width> and lays a little of the plainly resized original over it, so paper grain survives.
import AppKit
let a = CommandLine.arguments
func load(_ p: String) -> CGImage { NSImage(contentsOfFile: p)!.cgImage(forProposedRect: nil, context: nil, hints: nil)! }
let hd = load(a[1]), orig = load(a[2]), w = Int(a[4])!, mix = a.count > 5 ? Double(a[5])! : 0.18
let h = Int((Double(w) * Double(hd.height) / Double(hd.width)).rounded())
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.interpolationQuality = .high
ctx.draw(hd, in: CGRect(x: 0, y: 0, width: w, height: h))
ctx.setAlpha(mix); ctx.draw(orig, in: CGRect(x: 0, y: 0, width: w, height: h))
let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[3]))
