import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { objectStorageClient } from "../lib/app-storage-client";

const filenames = [
  "EDD6D58A-06E4-4A7F-9FDA-AE35345584D0_1794065918686.webp",
  "8A5626C5-8109-417A-A989-E59AD0066420_1794065918687.webp",
  "792B65BA-B5D8-42EC-8E8E-D2675DCE7843_1794065918687.jpeg",
  "8F6820EA-99B3-4276-8741-1B083A63380C_1794065918687.jpeg",
  "43AA4CE6-A5B0-4E57-99C2-3355959C0475_1794065918687.jpeg",
  "2638F0C8-F311-4625-8152-7DCF3F3C63AE_1794065918687.jpeg",
  "9426C9FA-623E-4EEE-9381-7D115C8FDF33_1794065918687.jpeg",
  "0DCDB457-B07E-4EA0-8777-847D8A6F272D_1794065918687.png",
  "B39179C7-D9C4-4DBB-A883-D61CFC6DE0BF_1794065918687.png",
  "E0D9B96A-94B3-4256-9F83-130526A42F63_1794065918687.jpeg",
  "1737948658082_extended_image_cropped_image_1794065918687.jpeg",
  "1737948576849_extended_image_cropped_image_1794065918687.jpeg",
  "1737948783658_extended_image_cropped_image_1794065918687.jpeg",
  "8851936B-A522-4C0E-A1A3-9177537B2B37_1794065918687.png",
  "B4305C79-E406-480C-A5F0-7C81B4059C0E_1794065918687.png",
  "AED2815B-6437-4CF9-AE82-D1A14246E131_1794065918687.png",
  "66AB8722-919D-4EFC-BDFA-585A29BB87C6_1794065918687.png",
  "D7F06A0B-143E-4DAF-8372-53D3C16D8D08_1794065918687.png",
  "08602E47-9602-430E-9C9D-C17F4B9F897E_1794065918687.png",
];

function getContentType(filename: string): string {
  if (filename.endsWith(".webp")) return "image/webp";
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".jpeg") || filename.endsWith(".jpg")) return "image/jpeg";
  throw new Error(`Unsupported visual format: ${filename}`);
}

function parsePublicSearchPath(searchPath: string): { bucketName: string; prefix: string } {
  const normalized = searchPath.replace(/^gs:\/\//, "").replace(/^\/+/, "").replace(/\/+$/, "");
  const [bucketName, ...prefixParts] = normalized.split("/");
  if (!bucketName) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS contains an invalid path.");
  return { bucketName, prefix: prefixParts.join("/") };
}

async function findAttachedAssetsDirectory(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), "attached_assets"),
    path.resolve(process.cwd(), "../../attached_assets"),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the other workspace-relative location.
    }
  }
  throw new Error("Could not locate attached_assets from the current working directory.");
}

async function main(): Promise<void> {
  const searchPath = (process.env.PUBLIC_OBJECT_SEARCH_PATHS ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)[0];
  if (!searchPath) {
    throw new Error("PUBLIC_OBJECT_SEARCH_PATHS is not configured.");
  }

  const { bucketName, prefix } = parsePublicSearchPath(searchPath);
  const assetDirectory = await findAttachedAssetsDirectory();
  const destinationPrefix = [prefix, "zioncore-vision"].filter(Boolean).join("/");

  for (const filename of filenames) {
    const sourcePath = path.join(assetDirectory, filename);
    await access(sourcePath);
    const objectName = [destinationPrefix, filename].filter(Boolean).join("/");
    const destination = objectStorageClient.bucket(bucketName).file(objectName);
    const stream = destination.createWriteStream({
      resumable: false,
      metadata: {
        contentType: getContentType(filename),
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    await pipeline(createReadStream(sourcePath), stream);
  }

  process.stdout.write(`Uploaded ${filenames.length} original ZionCore visual assets to App Storage.\n`);
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : "Visual asset upload failed."}\n`);
  process.exitCode = 1;
});
