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

@router.api_route("/api/v1/auth/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_auth(request: Request, path: str):
    return await forward_request(request, f"auth/{path}")

@router.api_route("/api/v1/baby/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_baby(request: Request, path: str):
    return await forward_request(request, f"baby/{path}")

@router.api_route("/api/v1/growth/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_growth(request: Request, path: str):
    return await forward_request(request, f"growth/{path}")
