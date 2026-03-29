from fastmcp import FastMCP
import subprocess
import os

mcp = FastMCP("Earthkeeper Tools")

PYTHON = r"C:\Users\james\AppData\Local\Programs\Python\Python311\python.exe"

@mcp.tool
def run_python(code: str) -> str:
    """Run Python code on this machine and return the output."""
    result = subprocess.run(
        [PYTHON, "-c", code],
        capture_output=True, text=True, timeout=120,
        creationflags=subprocess.CREATE_NO_WINDOW
    )
    output = result.stdout
    if result.stderr:
        output += "\nSTDERR:\n" + result.stderr
    return output or "(no output)"

@mcp.tool
def run_python_file(filepath: str) -> str:
    """Run a Python script file and return the output."""
    result = subprocess.run(
        [PYTHON, filepath],
        capture_output=True, text=True, timeout=300,
        creationflags=subprocess.CREATE_NO_WINDOW
    )
    output = result.stdout
    if result.stderr:
        output += "\nSTDERR:\n" + result.stderr
    return output or "(no output)"

@mcp.tool
def read_file(filepath: str) -> str:
    """Read a file and return its contents."""
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()

@mcp.tool
def write_file(filepath: str, content: str) -> str:
    """Write content to a file, creating directories as needed."""
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    return f"Written to {filepath}"

@mcp.tool
def list_files(directory: str) -> str:
    """List files in a directory."""
    return "\n".join(sorted(os.listdir(directory)))

@mcp.tool
def pip_install(package: str) -> str:
    """Install a Python package."""
    result = subprocess.run(
        [PYTHON, "-m", "pip", "install", package],
        capture_output=True, text=True, timeout=120,
        creationflags=subprocess.CREATE_NO_WINDOW
    )
    return result.stdout + result.stderr

if __name__ == "__main__":
    mcp.run()
