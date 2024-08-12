import React from 'react';

function FileUpload({ setFile }) {
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
  };

  return (
    <div className="file-upload">
      <input type="file" accept=".pdf" onChange={handleFileChange} />
    </div>
  );
}

export default FileUpload;