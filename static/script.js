let stream = null;

document.getElementById('openCamBtn').onclick = function() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const uploadedImg = document.getElementById('uploadedImg');
    
    // Hide other elements
    canvas.style.display = 'none';
    uploadedImg.style.display = 'none';
    video.style.display = 'block';
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(videoStream => {
            stream = videoStream;
            video.srcObject = stream;
            
            // Add capture button when camera is open
            const captureBtn = document.createElement('button');
            captureBtn.textContent = 'Capture';
            captureBtn.className = 'btn btn-primary mt-2';
            captureBtn.onclick = function() {
                const canvas = document.getElementById('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                
                // Convert canvas to blob and upload
                canvas.toBlob(blob => {
                    const formData = new FormData();
                    formData.append('image', blob, 'capture.jpg');
                    uploadImage(formData);
                }, 'image/jpeg');
                
                // Stop the camera
                stream.getTracks().forEach(track => track.stop());
                video.style.display = 'none';
                canvas.style.display = 'block';
                captureBtn.remove();
            };
            
            // Add the capture button after the video element
            video.parentNode.insertBefore(captureBtn, video.nextSibling);
        });
};

document.getElementById('uploadBtn').onclick = function() {
    document.getElementById('fileInput').click();
};

document.getElementById('fileInput').onchange = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Hide video and canvas
    document.getElementById('video').style.display = 'none';
    document.getElementById('canvas').style.display = 'none';
    
    const formData = new FormData();
    formData.append('image', file);
    uploadImage(formData);
};

function uploadImage(formData) {
    fetch('/upload', { 
        method: 'POST', 
        body: formData 
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const img = document.getElementById('uploadedImg');
            img.src = data.filepath;
            img.style.display = 'block';
            
            // Update parsed information
            document.getElementById('nameField').textContent = data.parsed_info.full_name || '-';
            document.getElementById('emailField').textContent = data.parsed_info.email || '-';
            document.getElementById('phoneField').textContent = data.parsed_info.phone || '-';
            document.getElementById('companyField').textContent = data.parsed_info.company || '-';
            document.getElementById('designationField').textContent = data.parsed_info.designation || '-';
            document.getElementById('addressField').textContent = data.parsed_info.address || '-';
            document.getElementById('websiteField').textContent = data.parsed_info.website || '-';
            
            // Add the new card to the history without refreshing
            const cardsHistory = document.getElementById('cardsHistory');
            const newCard = document.createElement('div');
            newCard.className = 'col-md-6 mb-4';
            newCard.innerHTML = `
                <div class="card">
                    <div class="row g-0">
                        <div class="col-md-4">
                            <img src="${data.filepath}" class="img-fluid rounded-start" alt="Business Card">
                        </div>
                        <div class="col-md-8">
                            <div class="card-body">
                                <h5 class="card-title">${data.parsed_info.full_name || '-'}</h5>
                                <p class="card-text">${data.parsed_info.designation || '-'}</p>
                                <p class="card-text">${data.parsed_info.company || '-'}</p>
                                <p class="card-text"><small>${data.parsed_info.email || '-'}</small></p>
                                <p class="card-text"><small>${data.parsed_info.phone || '-'}</small></p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            cardsHistory.insertBefore(newCard, cardsHistory.firstChild);
        } else {
            alert(data.error || 'An error occurred while processing the image');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while uploading the image');
    });
}
