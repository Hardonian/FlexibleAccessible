import { NextResponse } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { ApiError } from "@aros/shared";
import { getPublicScanById, getPublicScanEvidenceState, toPublicScanApiPayload } from "@/lib/public-scan/validity";

/**
 * GET /api/public-scan/[id]
 * Poll for public scan result by ID. Used by the results page to show
 * live progress and final results.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const scan = await getPublicScanById(id);

    if (!scan) {
      return apiError(ApiError.notFound("Scan not found"));
    }
    if (getPublicScanEvidenceState(scan) === "expired") {
      return apiError(
        new ApiError(
          "Scan result has expired. Start a new scan to generate fresh evidence.",
          "SCAN_EXPIRED",
          410,
        ),
      );
    }

    return apiSuccess(toPublicScanApiPayload(scan));
  } catch (error) {
    return apiError(error);
  }
}
