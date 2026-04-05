/**
 * POST /api/blob/upload
 * Handle client-side uploads to Vercel Blob.
 * This route generates upload tokens - the actual file goes directly from browser to Blob.
 */

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Validate file type and size here if needed
        // pathname is the intended file path in blob storage
        return {
          allowedContentTypes: ["application/json"],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500MB max
          tokenPayload: JSON.stringify({
            uploadedAt: Date.now(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Called after the file is uploaded to Vercel Blob
        // You can update your database here if needed
        console.log("[blob/upload] Upload completed:", blob.pathname);
        try {
          const payload = JSON.parse(tokenPayload || "{}");
          console.log("[blob/upload] Token payload:", payload);
        } catch {
          // Ignore parse errors
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[blob/upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
