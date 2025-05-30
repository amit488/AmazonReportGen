
document.getElementById("uploadBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("csvFile");
    const file = fileInput.files[0];
    const email = localStorage.getItem("email");
  
    if (!file || !email) {
      alert("Missing email or file.");
      return;
    }
  
    if (!file.name.endsWith(".csv")) {
      alert("Only CSV files allowed.");
      return;
    }
  
    const renamedFile = renameFileWithTimestampAndEmail(file, email);
  
    try {
      // Get presigned URL
      const res = await fetch("http://localhost:3000/get-presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: renamedFile.name, email }),
      });
  
      const { url, timestamp } = await res.json();
  
      // Upload file to S3
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "text/csv" },
        body: renamedFile,
      });
  
      alert("Upload successful!");
  
      // Send metadata to DynamoDB
      await fetch("http://localhost:3000/log-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: renamedFile.name, email, timestamp }),
      });
  
    } catch (err) {
      console.error("Error uploading file", err);
      alert("Upload failed.");
    }
  });
  function renameFileWithTimestampAndEmail(file, email) {
    const fileExt = file.name.toString().split('.').pop();
    const fileNameWithoutExt = file.name.toString().substring(0, file.name.toString().lastIndexOf('.'));
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9.]/g, '_');
    const newFilename = `${fileNameWithoutExt}_${sanitizedEmail}_.${fileExt}`;
    return new File([file], newFilename, {
        type: file.type
    });
}


  