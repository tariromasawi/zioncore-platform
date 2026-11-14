import { Router, type IRouter } from "express";
import { searchPublicAudioObject } from "../lib/public-audio-storage";
import { ownPublicAsset, stopAssetOnDisconnect } from "../lib/public-asset-safety";

const router: IRouter = Router();

const visualAssets = Object.freeze({
  "community-globe": {
    objectPath: "zioncore-vision/EDD6D58A-06E4-4A7F-9FDA-AE35345584D0_1794065918686.webp",
    contentType: "image/webp",
  },
  "radiant-convergence": {
    objectPath: "zioncore-vision/8A5626C5-8109-417A-A989-E59AD0066420_1794065918687.webp",
    contentType: "image/webp",
  },
  "golden-gathering": {
    objectPath: "zioncore-vision/792B65BA-B5D8-42EC-8E8E-D2675DCE7843_1794065918687.jpeg",
    contentType: "image/jpeg",
  },
  "life-growth-map": {
    objectPath: "zioncore-vision/8F6820EA-99B3-4276-8741-1B083A63380C_1794065918687.jpeg",
    contentType: "image/jpeg",
  },
  "dove-circuit": {
    objectPath: "zioncore-vision/43AA4CE6-A5B0-4E57-99C2-3355959C0475_1794065918687.jpeg",
    contentType: "image/jpeg",
  },
  "radiant-figure": {
    objectPath: "zioncore-vision/2638F0C8-F311-4625-8152-7DCF3F3C63AE_1794065918687.jpeg",
    contentType: "image/jpeg",
  },
  "path-to-light": {
    objectPath: "zioncore-vision/9426C9FA-623E-4EEE-9381-7D115C8FDF33_1794065918687.jpeg",
    contentType: "image/jpeg",
  },
  "golden-orbit": {
    objectPath: "zioncore-vision/0DCDB457-B07E-4EA0-8777-847D8A6F272D_1794065918687.png",
    contentType: "image/png",
  },
  "blueprint-of-resonance": {
    objectPath: "zioncore-vision/B39179C7-D9C4-4DBB-A883-D61CFC6DE0BF_1794065918687.png",
    contentType: "image/png",
  },
  "celestial-blueprint": {
    objectPath: "zioncore-vision/E0D9B96A-94B3-4256-9F83-130526A42F63_1794065918687.jpeg",
    contentType: "image/jpeg",
  },
  "symbolic-atlas": {
    objectPath: "zioncore-vision/1737948658082_extended_image_cropped_image_1794065918687.jpeg",
    contentType: "image/jpeg",
  },
  "blue-center-mandala": {
    objectPath: "zioncore-vision/1737948576849_extended_image_cropped_image_1794065918687.jpeg",
    contentType: "image/jpeg",
  },
  "radiant-symbolic-wheel": {
    objectPath: "zioncore-vision/1737948783658_extended_image_cropped_image_1794065918687.jpeg",
    contentType: "image/jpeg",
  },
  "molecular-mandala": {
    objectPath: "zioncore-vision/8851936B-A522-4C0E-A1A3-9177537B2B37_1794065918687.png",
    contentType: "image/png",
  },
  "night-sky-diagram": {
    objectPath: "zioncore-vision/B4305C79-E406-480C-A5F0-7C81B4059C0E_1794065918687.png",
    contentType: "image/png",
  },
  "radiant-city": {
    objectPath: "zioncore-vision/AED2815B-6437-4CF9-AE82-D1A14246E131_1794065918687.png",
    contentType: "image/png",
  },
  "golden-flower": {
    objectPath: "zioncore-vision/66AB8722-919D-4EFC-BDFA-585A29BB87C6_1794065918687.png",
    contentType: "image/png",
  },
  "cosmic-lattice": {
    objectPath: "zioncore-vision/D7F06A0B-143E-4DAF-8372-53D3C16D8D08_1794065918687.png",
    contentType: "image/png",
  },
  "radiant-face": {
    objectPath: "zioncore-vision/08602E47-9602-430E-9C9D-C17F4B9F897E_1794065918687.png",
    contentType: "image/png",
  },
});

router.get("/resonance-visuals/:assetId", async (req, res): Promise<void> => {
  const rawAssetId = req.params.assetId;
  const assetId = Array.isArray(rawAssetId) ? rawAssetId[0] : rawAssetId;
  const asset = ownPublicAsset(visualAssets, assetId);

  if (!asset) {
    res.status(404).json({ error: "That ZionCore visual was not found." });
    return;
  }

  let file;
  try {
    file = await searchPublicAudioObject(asset.objectPath);
  } catch {
    req.log.error({ assetId }, "Could not locate a ZionCore visual in App Storage");
    res.status(503).json({ error: "The ZionCore visual is temporarily unavailable." });
    return;
  }

  if (!file) {
    req.log.warn({ assetId }, "ZionCore visual is missing from App Storage");
    res.status(404).json({ error: "That ZionCore visual is not available." });
    return;
  }

  if (res.destroyed) return;
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Content-Type", asset.contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");

  const stream = file.createReadStream();
  stopAssetOnDisconnect(stream, res, { waitForStorageResponse: true });
  stream.on("error", () => {
    if (res.destroyed) return;
    req.log.error({ assetId }, "ZionCore visual stream failed");
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.type("application/json").status(503).json({ error: "The ZionCore visual is temporarily unavailable." });
  });
  stream.pipe(res);
});

export default router;
