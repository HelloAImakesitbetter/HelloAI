export async function GET() {
  return Response.json({
    name: "HelloAI API",
    version: "v1",
    status: "ok",
    services: ["chat"],
  });
}
