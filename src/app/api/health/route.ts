import { NextResponse } from "next/server";

/**
 * Health check endpoint for Docker and load balancer health checks
 * GET /api/health
 */
export async function GET() {
  try {
    // Basic health check
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}

// Also respond to HEAD requests for lightweight health checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
