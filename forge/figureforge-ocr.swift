import Foundation
import ImageIO
import Vision

guard CommandLine.arguments.count == 2 else { exit(1) }
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { exit(1) }
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
request.recognitionLanguages = ["en-US"]
try VNImageRequestHandler(cgImage: image).perform([request])
let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
let count = lines.joined().unicodeScalars.filter { !CharacterSet.whitespacesAndNewlines.contains($0) }.count
let data = try JSONSerialization.data(withJSONObject: ["characters": count])
FileHandle.standardOutput.write(data)
