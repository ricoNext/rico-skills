function fileNameOf(path: string): string {
    const parts = path.split("/");
    return parts[parts.length - 1] || path;
  }
  
  function dirOf(path: string): string {
    const index = path.lastIndexOf("/");
    return index >= 0 ? path.slice(0, index) : "";
  }