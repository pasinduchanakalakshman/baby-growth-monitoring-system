from fastapi import APIRouter, Request, Response
import httpx
from app.config import settings

router = APIRouter()

async def forward_request(request: Request, path: str):
    url = f"{settings.CHILD_GROWTH_MONITORING_URL}/api/v1/{path}"
    
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)
    
    async with httpx.AsyncClient() as client:
        req = client.build_request(
            method=request.method,
            url=url,
            headers=headers,
            params=request.query_params,
            content=await request.body()
        )
        try:
            rp_resp = await client.send(req)
        except httpx.RequestError as exc:
            return Response(content=f"Error forwarding request: {exc}", status_code=502)
        
        # Build the response with preserved status and headers
        response = Response(
            content=rp_resp.content,
            status_code=rp_resp.status_code,
            headers=dict(rp_resp.headers)
        )
        return response

async def proxy_auth(request: Request, path: str):
    return await forward_request(request, f"auth/{path}")

async def proxy_baby(request: Request, path: str):
    return await forward_request(request, f"baby/{path}")

async def proxy_growth(request: Request, path: str):
    return await forward_request(request, f"growth/{path}")

async def proxy_nutrition(request: Request, path: str):
    return await forward_request(request, f"nutrition/{path}")

METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
for method in METHODS:
    router.add_api_route("/api/v1/auth/{path:path}", proxy_auth, methods=[method], operation_id=f"proxy_auth_{method.lower()}")
    router.add_api_route("/api/v1/baby/{path:path}", proxy_baby, methods=[method], operation_id=f"proxy_baby_{method.lower()}")
    router.add_api_route("/api/v1/growth/{path:path}", proxy_growth, methods=[method], operation_id=f"proxy_growth_{method.lower()}")
    router.add_api_route("/api/v1/nutrition/{path:path}", proxy_nutrition, methods=[method], operation_id=f"proxy_nutrition_{method.lower()}")
