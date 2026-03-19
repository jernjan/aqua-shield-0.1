"""Minimal FastAPI server for testing."""
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()

@app.get("/")
async def root():
    return {"status": "ok"}

@app.get("/test")
async def test():
    return {"message": "test response"}

if __name__ == "__main__":
    import uvicorn
    print("Starting minimal test server...")
    uvicorn.run(app, host="127.0.0.1", port=8001)
