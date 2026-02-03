"""
FastAPI application entry point for MapVisual Sophisticated Visualization Engine.
"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pathlib import Path

from app.routers import mobile, geo

# Initialize FastAPI app
app = FastAPI(
    title="MapVisual Visualization Engine",
    description="Interactive US map visualization with mobile subscriber data",
    version="1.0.0"
)

# Setup templates
templates_dir = Path(__file__).parent.parent / "templates"
templates = Jinja2Templates(directory=str(templates_dir))

# Mount static files
static_dir = Path(__file__).parent.parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Include routers
app.include_router(mobile.router)
app.include_router(geo.router)


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """
    Serve the main visualization page.
    """
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
async def health_check():
    """
    Health check endpoint for container orchestration.
    """
    return {"status": "healthy", "service": "mapvisual"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
