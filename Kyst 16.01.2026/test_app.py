from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "OK"}

@app.get("/test")
def test():
    return {"status": "test"}
