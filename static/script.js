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
            newCard.className = 'history-card';
            newCard.innerHTML = `
                <img src="${data.filepath}" alt="Business Card">
                <div class="flex-grow-1">
                    <h6 class="mb-1">${data.parsed_info.full_name || 'Unnamed'}</h6>
                    <p class="text-muted mb-1">${data.parsed_info.designation || 'No designation'}</p>
                    <p class="mb-2"><strong>${data.parsed_info.company || 'No company'}</strong></p>
                    <div class="d-flex gap-3">
                        <small class="text-primary">
                            <i class="bi bi-envelope me-1"></i>${data.parsed_info.email || 'No email'}
                        </small>
                        <small class="text-primary">
                            <i class="bi bi-telephone me-1"></i>${data.parsed_info.phone || 'No phone'}
                        </small>
                    </div>
                </div>
                <div class="ms-auto">
                    <button class="btn btn-outline-danger btn-sm delete-card-btn" data-card-id="${data.card_id || ''}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
            cardsHistory.insertBefore(newCard, cardsHistory.firstChild);
            
            // Add event listener to the new delete button
            const newDeleteBtn = newCard.querySelector('.delete-card-btn');
            if (newDeleteBtn) {
                newDeleteBtn.addEventListener('click', function() {
                    deleteCard(this.getAttribute('data-card-id'), newCard);
                });
            }
        } else {
            alert(data.error || 'An error occurred while processing the image');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred while uploading the image');
    });
}

// Delete card function
function deleteCard(cardId, cardElement) {
    if (!cardId) {
        alert('Cannot delete this card - no ID found');
        return;
    }
    
    if (confirm('Are you sure you want to delete this card?')) {
        fetch(`/delete-card/${cardId}`, {
            method: 'DELETE'
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Remove the card from the UI
                cardElement.remove();
                alert('Card deleted successfully');
            } else {
                alert(data.error || 'Failed to delete card');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while deleting the card');
        });
    }
}

// Add event listeners to existing delete buttons when page loads
document.addEventListener('DOMContentLoaded', function() {
    const deleteButtons = document.querySelectorAll('.delete-card-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const cardId = this.getAttribute('data-card-id');
            const cardElement = this.closest('.history-card');
            deleteCard(cardId, cardElement);
        });
    });
});
