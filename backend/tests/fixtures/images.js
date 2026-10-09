// Minimal valid file signatures for upload tests (content is never decoded
// because the AI extractor is mocked; only magic-byte validation runs).

export const jpegBuffer = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  Buffer.alloc(20, 0)
]);

export const notAnImageBuffer = Buffer.from('this is definitely not an image file');
