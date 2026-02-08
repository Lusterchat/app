import { supabase } from '../../utils/supabase.js';

console.log('✨ Image Handler Initialized - MULTI-IMAGE VERSION 🎉');

// ====================
// IMAGE HANDLING VARIABLES
// ====================
let selectedColor = null;
let colorPickerVisible = false;
let isImagePickerOpen = false;
let selectedImages = []; // Array for multiple images
let currentImageIndex = 0;
let uploadInProgress = false;
let isUploadingMultiple = false;
let uploadQueue = [];

// API Key
const IMGBB_API_KEY = '82e49b432e2ee14921f7d0cd81ba5551';

// ====================
// GLOBAL FUNCTION EXPORTS
// ====================
window.selectColor = selectColor;
window.hideColorPicker = hideColorPicker;
window.showColorPicker = showColorPicker;
window.showImagePicker = showImagePicker;
window.closeImagePicker = closeImagePicker;
window.openCamera = openCamera;
window.openGallery = openGallery;
window.viewImageFullscreen = viewImageFullscreen;
window.closeImageViewer = closeImageViewer;
window.downloadImage = downloadImage;
window.shareImage = shareImage;
window.handleImageLoad = handleImageLoad;
window.handleImageError = handleImageError;
window.cancelImageUpload = cancelImageUpload;
window.sendImagePreview = sendImagePreview;
window.createImageMessageHTML = createImageMessageHTML;
window.uploadImageFromPreview = uploadImageFromPreview;
window.removeSelectedColor = removeSelectedColor;
window.cancelColorSelection = cancelColorSelection;
window.handleImageSelect = handleImageSelect;
window.isMobileChrome = isMobileChrome;
window.fixImgBBUrls = fixImgBBUrls;
window.getImgBBUrlWithFallback = getImgBBUrlWithFallback;
window.prevImage = prevImage;
window.nextImage = nextImage;

// Signal that img-handler is loaded
if (window.chatModules) {
    window.chatModules.imgHandlerLoaded = true;
    console.log('✅ img-handler.js loaded and ready');
}

// ====================
// MOBILE DETECTION
// ====================
function isMobileChrome() {
    const ua = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isChrome = /Chrome/i.test(ua) && !/Edge|Edg|OPR/i.test(ua);
    return isMobile && isChrome;
}

function isIOSChrome() {
    const ua = navigator.userAgent;
    return /CriOS/i.test(ua) && /iPhone|iPad|iPod/i.test(ua);
}

// ====================
// URL FIXER
// ====================
function fixImgBBUrls(url) {
    if (!url || !url.includes('ibb.co')) return url;

    let fixedUrl = url;

    if (isMobileChrome() || isIOSChrome()) {
        fixedUrl = fixedUrl.replace('https://ibb.co/', 'https://i.ibb.co/');
        fixedUrl = fixedUrl.replace('http://ibb.co/', 'https://i.ibb.co/');

        if (!fixedUrl.includes('.jpg') && !fixedUrl.includes('.png') && !fixedUrl.includes('.gif')) {
            fixedUrl += '.jpg';
        }

        const cacheBuster = `?mobile_${Date.now()}`;
        if (!fixedUrl.includes('?')) {
            fixedUrl += cacheBuster;
        } else {
            fixedUrl = fixedUrl.split('?')[0] + cacheBuster;
        }
    }

    return ensureHttpsUrl(url);
}

function getImgBBUrlWithFallback(imageCode) {
    if (isMobileChrome() || isIOSChrome()) {
        return `https://i.ibb.co/${imageCode}.jpg?mobile=${Date.now()}`;
    }

    return `https://i.ibb.co/${imageCode}.jpg?cb=${Date.now()}`;
}

function ensureHttpsUrl(url) {
    if (!url) return url;

    let fixedUrl = url;

    if (fixedUrl.startsWith('http://')) {
        fixedUrl = fixedUrl.replace('http://', 'https://');
    }

    if (fixedUrl.startsWith('https://https://')) {
        fixedUrl = fixedUrl.replace('https://https://', 'https://');
    }

    const cacheBuster = isMobileChrome() ? `?mcb=${Date.now()}` : `?cb=${Date.now()}`;
    if (!fixedUrl.includes('?')) {
        fixedUrl += cacheBuster;
    } else if (!fixedUrl.includes('cb=') && !fixedUrl.includes('mobile=') && !fixedUrl.includes('t=')) {
        fixedUrl += '&' + cacheBuster.substring(1);
    }

    return fixedUrl;
}

// ====================
// INITIALIZATION
// ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 Initializing image handler...');

    setTimeout(() => {
        initializeColorPicker();
        setupSlashHandler();
        setupFileInputListeners();
        setupColorPickerClickOutside();

        if (isMobileChrome() || isIOSChrome()) {
            applyMobileChromeFixes();
        }

        console.log('✅ Image handler ready!');
        setTimeout(addColorPickerToDOM, 100);
    }, 300);
});

// ====================
// MOBILE CHROME FIXES
// ====================
function applyMobileChromeFixes() {
    console.log('Applying Mobile Chrome fixes...');

    document.body.classList.add('chrome-mobile');

    document.addEventListener('touchstart', function(e) {
        if (e.target.id === 'cameraInput' || e.target.id === 'galleryInput') {
            e.preventDefault();
        }
    }, { passive: false });

    document.body.style.overscrollBehavior = 'none';

    function setVH() {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    setVH();
    window.addEventListener('resize', setVH);

    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);

    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            setTimeout(() => {
                window.scrollTo(0, 0);
            }, 50);
        });
    });
}

// ====================
// COLOR PICKER SETUP
// ====================
function addColorPickerToDOM() {
    if (document.getElementById('colorPickerOverlay')) {
        console.log('Color picker already in DOM');
        return;
    }

    const colorPickerHTML = `
        <div class="color-picker-overlay" id="colorPickerOverlay" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <div style="font-size: 0.9rem; color: #a0a0c0;">Choose text color</div>
                <button style="background: rgba(255,255,255,0.1); border: none; color: #a0a0c0; width: 28px; height: 28px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center;" onclick="cancelColorSelection()">×</button>
            </div>
            <div class="color-picker-grid">
                <div class="color-option" data-color="red" onclick="selectColor('red')" title="Red"></div>
                <div class="color-option" data-color="green" onclick="selectColor('green')" title="Green"></div>
                <div class="color-option" data-color="blue" onclick="selectColor('blue')" title="Blue"></div>
                <div class="color-option" data-color="white" onclick="selectColor('white')" title="White"></div>
                <div class="color-option" data-color="black" onclick="selectColor('black')" title="Black"></div>
                <div class="color-option" data-color="yellow" onclick="selectColor('yellow')" title="Yellow"></div>
                <div class="color-option" data-color="cyan" onclick="selectColor('cyan')" title="Cyan"></div>
                <div class="color-option" data-color="purple" onclick="selectColor('purple')" title="Purple"></div>
                <div class="color-option" data-color="pink" onclick="selectColor('pink')" title="Pink"></div>
                <div class="color-option" data-color="orange" onclick="selectColor('orange')" title="Orange"></div>
            </div>
            <div class="color-picker-footer">
                <button class="color-clear-btn" onclick="removeSelectedColor()">
                    <svg viewBox="0 0 24 24" width="16" height="16" style="margin-right: 5px;">
                        <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                    </svg>
                    Clear Color
                </button>
            </div>
        </div>
    `;

    const inputWrapper = document.querySelector('.message-input-wrapper');
    if (inputWrapper) {
        inputWrapper.insertAdjacentHTML('beforebegin', colorPickerHTML);
        console.log('✅ Color picker added to DOM');
    } else {
        document.body.insertAdjacentHTML('beforeend', colorPickerHTML);
    }
}

function initializeColorPicker() {
    setTimeout(() => {
        if (!document.getElementById('colorPickerOverlay')) {
            addColorPickerToDOM();
        }
    }, 200);
}

function setupColorPickerClickOutside() {
    document.addEventListener('click', function(e) {
        if (!colorPickerVisible) return;

        const colorPicker = document.getElementById('colorPickerOverlay');
        const input = document.getElementById('messageInput');

        if (colorPicker && !colorPicker.contains(e.target) && e.target !== input) {
            cancelColorSelection();
        }
    });
}

function showColorPicker() {
    console.log('Showing color picker...');
    const colorPicker = document.getElementById('colorPickerOverlay');
    if (colorPicker) {
        colorPickerVisible = true;
        window.colorPickerVisible = true;

        colorPicker.style.display = 'flex';
        setTimeout(() => {
            colorPicker.style.opacity = '1';
        }, 10);

        const colorOptions = document.querySelectorAll('.color-option');
        colorOptions.forEach(option => {
            option.classList.remove('selected');
        });

        console.log('✅ Color picker shown');
    } else {
        console.log('❌ Color picker not found in DOM');
        addColorPickerToDOM();
        setTimeout(showColorPicker, 50);
    }
}

function hideColorPicker() {
    console.log('Hiding color picker...');
    const colorPicker = document.getElementById('colorPickerOverlay');
    if (colorPicker) {
        colorPickerVisible = false;
        window.colorPickerVisible = false;

        colorPicker.style.opacity = '0';
        setTimeout(() => {
            colorPicker.style.display = 'none';
        }, 150);
    }
}

function cancelColorSelection() {
    console.log('Cancelling color selection');
    hideColorPicker();

    const input = document.getElementById('messageInput');
    if (input && input.value === '/') {
        input.value = '';
        if (typeof autoResize === 'function') {
            autoResize(input);
        }
    }
}

function removeSelectedColor() {
    console.log('Removing selected color');
    selectedColor = null;
    window.selectedColor = null;

    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.classList.remove('selected');
    });

    if (typeof showToast === 'function') {
        showToast('Color cleared', '↩️', 800);
    }

    setTimeout(() => {
        hideColorPicker();

        const input = document.getElementById('messageInput');
        if (input) {
            input.focus();
            if (input.value === '/') {
                input.value = '';
                if (typeof autoResize === 'function') {
                    autoResize(input);
                }
            }
        }
    }, 500);
}

function selectColor(color) {
    console.log('Selected color:', color);
    selectedColor = color;
    window.selectedColor = color;

    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.classList.remove('selected');
        if (option.getAttribute('data-color') === color) {
            option.classList.add('selected');
        }
    });

    if (typeof showToast === 'function') {
        showToast(`${color} color selected`, '🎨', 800);
    }

    setTimeout(() => {
        hideColorPicker();

        const input = document.getElementById('messageInput');
        if (input) {
            input.focus();
            if (input.value === '/') {
                input.value = '';
                if (typeof autoResize === 'function') {
                    autoResize(input);
                }
            }
        }
    }, 500);
}

// ====================
// SLASH HANDLER
// ====================
function setupSlashHandler() {
    const input = document.getElementById('messageInput');
    if (!input) {
        console.log('❌ Message input not found');
        return;
    }

    console.log('✅ Setting up slash handler');

    input.addEventListener('input', function(e) {
        const text = e.target.value;

        if (text === '/' && !colorPickerVisible) {
            console.log('✅ Slash detected, showing color picker');
            showColorPicker();
        } 
        else if (colorPickerVisible && text !== '/') {
            console.log('❌ Text changed, hiding color picker');
            hideColorPicker();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && colorPickerVisible) {
            e.preventDefault();
            cancelColorSelection();
        }
    });
}

// ====================
// IMAGE PICKER FUNCTIONS
// ====================
function showImagePicker() {
    console.log('Showing image picker');

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!currentUser) {
        console.log('User not authenticated');
        if (typeof showToast === 'function') {
            showToast('Please login to send images', '⚠️');
        }
        return;
    }

    setTimeout(() => {
        isImagePickerOpen = true;
        const picker = document.getElementById('imagePickerOverlay');
        if (picker) {
            picker.style.display = 'flex';
            setTimeout(() => {
                picker.style.opacity = '1';
            }, 10);

            document.body.style.overflow = 'hidden';
            console.log('✅ Image picker shown');
        }
    }, isMobileChrome() ? 50 : 0);
}

function closeImagePicker() {
    if (uploadInProgress) {
        console.log('Upload in progress, not closing picker');
        return;
    }

    isImagePickerOpen = false;
    const picker = document.getElementById('imagePickerOverlay');
    if (picker) {
        picker.style.opacity = '0';
        setTimeout(() => {
            picker.style.display = 'none';
            document.body.style.overflow = '';
        }, 150);
        console.log('✅ Image picker closed');
    }
}

function openCamera() {
    console.log('Opening camera');

    if (isMobileChrome()) {
        const cameraInput = document.getElementById('cameraInput');
        if (cameraInput) {
            cameraInput.value = '';
            setTimeout(() => {
                cameraInput.click();
            }, 200);
        }
    } else {
        const cameraInput = document.getElementById('cameraInput');
        if (cameraInput) {
            cameraInput.value = '';
            cameraInput.click();
        }
    }
}

function openGallery() {
    console.log('Opening gallery');

    if (isMobileChrome()) {
        const galleryInput = document.getElementById('galleryInput');
        if (galleryInput) {
            galleryInput.value = '';
            setTimeout(() => {
                galleryInput.click();
            }, 200);
        }
    } else {
        const galleryInput = document.getElementById('galleryInput');
        if (galleryInput) {
            galleryInput.value = '';
            galleryInput.click();
        }
    }
}

function setupFileInputListeners() {
    const cameraInput = document.getElementById('cameraInput');
    const galleryInput = document.getElementById('galleryInput');

    if (cameraInput) {
        cameraInput.addEventListener('change', handleImageSelect);
    }

    if (galleryInput) {
        galleryInput.addEventListener('change', handleImageSelect);
    }
}

// ====================
// IMAGE SELECTION AND PREVIEW - MULTI-IMAGE SUPPORT
// ====================
function handleImageSelect(event) {
    console.log('File selected event triggered', event);

    try {
        const fileInput = event.target;

        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            console.error('No files selected in input');
            if (typeof showToast === 'function') {
                showToast('No images selected', '⚠️');
            }
            return;
        }

        const files = Array.from(fileInput.files);

        if (files.length === 0) {
            console.error('No valid files selected');
            if (typeof showToast === 'function') {
                showToast('No images selected', '⚠️');
            }
            return;
        }

        console.log(`✅ ${files.length} images selected`);

        // Validate all files
        const validFiles = [];
        const maxSize = isMobileChrome() || isIOSChrome() ? 20 * 1024 * 1024 : 10 * 1024 * 1024;

        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                console.log('Skipping non-image file:', file.name, file.type);
                continue;
            }

            if (file.size > maxSize) {
                console.log('File too large, skipping:', file.name, file.size);
                if (typeof showToast === 'function') {
                    showToast(`${file.name} is too large (max ${maxSize/(1024*1024)}MB)`, '⚠️');
                }
                continue;
            }

            validFiles.push(file);
        }

        if (validFiles.length === 0) {
            console.log('No valid image files selected');
            if (typeof showToast === 'function') {
                showToast('Please select valid image files', '⚠️');
            }
            fileInput.value = '';
            return;
        }

        if (validFiles.length > 10) {
            console.log('Too many images, limiting to 10');
            if (typeof showToast === 'function') {
                showToast('Limited to 10 images at once', '⚠️');
            }
            validFiles.splice(10);
        }

        // Store selected images
        selectedImages = validFiles;
        currentImageIndex = 0;

        console.log(`✅ ${selectedImages.length} valid images ready for preview`);

        // Create preview for first image
        createMultiImagePreview();

    } catch (error) {
        console.error('Error handling image selection:', error);
        if (typeof showToast === 'function') {
            showToast('Error selecting images', '❌');
        }

        document.getElementById('cameraInput').value = '';
        document.getElementById('galleryInput').value = '';
        selectedImages = [];
        currentImageIndex = 0;
    }
}

// ====================
// MULTI-IMAGE PREVIEW
// ====================

function createMultiImagePreview() {
    console.log('Creating multi-image preview');

    if (!selectedImages || selectedImages.length === 0) {
        console.error('No images to preview');
        if (typeof showToast === 'function') {
            showToast('No images to preview', '⚠️');
        }
        return;
    }

    const file = selectedImages[currentImageIndex];

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const imagePreviewUrl = e.target.result;

            const previewHTML = `
                <div class="image-preview-overlay" id="imagePreviewOverlay">
                    <div class="image-preview-container">
                        <div class="preview-header">
                            <h3>Image Preview</h3>
                            <button class="preview-close" onclick="cancelImageUpload()">×</button>
                        </div>
                        <div class="preview-image-wrapper">
                            ${selectedImages.length > 1 ? `
                                <div class="preview-counter">${currentImageIndex + 1}/${selectedImages.length}</div>
                            ` : ''}
                            <div class="preview-image-container">
                                <img src="${imagePreviewUrl}" alt="Preview" class="preview-image" onload="this.style.opacity='1'">
                            </div>
                            ${selectedImages.length > 1 ? `
                                <div style="display: flex; justify-content: space-between; margin-top: 15px;">
                                    <button onclick="prevImage()" class="preview-btn cancel" ${currentImageIndex === 0 ? 'disabled style="opacity:0.5"' : ''}>← Previous</button>
                                    <button onclick="nextImage()" class="preview-btn cancel" ${currentImageIndex === selectedImages.length - 1 ? 'disabled style="opacity:0.5"' : ''}>Next →</button>
                                </div>
                            ` : ''}
                        </div>
                        <div class="preview-actions">
                            <button class="preview-btn cancel" onclick="cancelImageUpload()">Cancel</button>
                            <button class="preview-btn send" onclick="uploadImageFromPreview()">
                                ${selectedImages.length > 1 ? `Send ${selectedImages.length} Images` : 'Send Image'}
                            </button>
                        </div>
                        <div class="preview-info">
                            <p>File: ${file.name}</p>
                            <p>Size: ${(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            <p>Type: ${file.type}</p>
                            ${selectedImages.length > 1 ? `<p>Total: ${selectedImages.length} images</p>` : ''}
                        </div>
                    </div>
                </div>
            `;

            const existingPreview = document.getElementById('imagePreviewOverlay');
            if (existingPreview) {
                existingPreview.remove();
            }

            document.body.insertAdjacentHTML('beforeend', previewHTML);

            closeImagePicker();

            setTimeout(() => {
                const preview = document.getElementById('imagePreviewOverlay');
                if (preview) {
                    preview.style.opacity = '1';

                    if (isMobileChrome() || isIOSChrome()) {
                        preview.addEventListener('touchmove', function(e) {
                            e.preventDefault();
                        }, { passive: false });
                    }

                    console.log('✅ Preview shown');
                }
            }, 10);
        } catch (error) {
            console.error('Error creating preview HTML:', error);
            if (typeof showToast === 'function') {
                showToast('Error creating preview', '❌');
            }
        }
    };

    reader.onerror = function(error) {
        console.error('Error reading file for preview:', error);
        if (typeof showToast === 'function') {
            showToast('Error reading image file', '❌');
        }
        document.getElementById('cameraInput').value = '';
        document.getElementById('galleryInput').value = '';
        selectedImages = [];
        currentImageIndex = 0;
        closeImagePicker();
    };

    reader.readAsDataURL(file);
}

function prevImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        updatePreviewImage();
    }
}

function nextImage() {
    if (currentImageIndex < selectedImages.length - 1) {
        currentImageIndex++;
        updatePreviewImage();
    }
}

function updatePreviewImage() {
    const previewContainer = document.querySelector('.preview-image-container img');
    const counter = document.querySelector('.preview-counter');
    const prevBtn = document.querySelector('button[onclick="prevImage()"]');
    const nextBtn = document.querySelector('button[onclick="nextImage()"]');
    
    if (!previewContainer || !selectedImages[currentImageIndex]) return;

    const file = selectedImages[currentImageIndex];
    const reader = new FileReader();

    reader.onload = function(e) {
        previewContainer.src = e.target.result;
        previewContainer.style.opacity = '0';
        setTimeout(() => {
            previewContainer.style.opacity = '1';
        }, 50);

        // Update counter
        if (counter) {
            counter.textContent = `${currentImageIndex + 1}/${selectedImages.length}`;
        }

        // Update buttons
        if (prevBtn) {
            prevBtn.disabled = currentImageIndex === 0;
            prevBtn.style.opacity = currentImageIndex === 0 ? '0.5' : '1';
        }
        
        if (nextBtn) {
            nextBtn.disabled = currentImageIndex === selectedImages.length - 1;
            nextBtn.style.opacity = currentImageIndex === selectedImages.length - 1 ? '0.5' : '1';
        }

        // Update file info
        const infoDiv = document.querySelector('.preview-info');
        if (infoDiv) {
            const fileInfo = infoDiv.querySelector('p:first-child');
            const sizeInfo = infoDiv.querySelector('p:nth-child(2)');
            const typeInfo = infoDiv.querySelector('p:nth-child(3)');
            
            if (fileInfo) fileInfo.textContent = `File: ${file.name}`;
            if (sizeInfo) sizeInfo.textContent = `Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
            if (typeInfo) typeInfo.textContent = `Type: ${file.type}`;
        }
    };

    reader.readAsDataURL(file);
}

// ====================
// IMAGE PREVIEW FUNCTIONS
// ====================
function cancelImageUpload() {
    console.log('Cancelling image upload');

    document.getElementById('cameraInput').value = '';
    document.getElementById('galleryInput').value = '';

    selectedImages = [];
    currentImageIndex = 0;
    uploadQueue = [];
    uploadInProgress = false;
    isUploadingMultiple = false;

    const preview = document.getElementById('imagePreviewOverlay');
    if (preview) {
        preview.style.opacity = '0';
        setTimeout(() => {
            preview.remove();
            console.log('✅ Preview removed');
        }, 150);
    }
}

function sendImagePreview() {
    console.log('sendImagePreview called');
    if (!selectedImages || selectedImages.length === 0) {
        console.log('No images to send');
        if (typeof showToast === 'function') {
            showToast('No images selected', '⚠️');
        }
        return;
    }
    uploadImageFromPreview();
}

async function uploadImageFromPreview() {
    console.log('uploadImageFromPreview called');

    if (uploadInProgress) {
        console.log('Upload already in progress');
        return;
    }

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const chatFriend = window.getChatFriend ? window.getChatFriend() : null;

    if (!currentUser) {
        console.log('User not authenticated');
        if (typeof showToast === 'function') {
            showToast('Please login to send images', '⚠️');
        }
        cancelImageUpload();
        return;
    }

    if (!chatFriend) {
        console.log('No chat friend');
        if (typeof showToast === 'function') {
            showToast('No chat friend selected', '⚠️');
        }
        cancelImageUpload();
        return;
    }

    if (!selectedImages || selectedImages.length === 0) {
        console.error('No images to upload');
        if (typeof showToast === 'function') {
            showToast('No images selected', '⚠️');
        }
        cancelImageUpload();
        return;
    }

    console.log(`Starting upload process for ${selectedImages.length} images`);
    
    uploadInProgress = true;
    isUploadingMultiple = selectedImages.length > 1;

    const preview = document.getElementById('imagePreviewOverlay');
    if (preview) {
        preview.style.opacity = '0';
        setTimeout(() => {
            preview.remove();
            console.log('✅ Preview removed');
        }, 150);
    }

    if (typeof showLoading === 'function') {
        showLoading(true, isUploadingMultiple ? 
            `Uploading 1/${selectedImages.length} images...` : 
            'Uploading image...');
    }

    try {
        if (isUploadingMultiple) {
            await uploadMultipleImagesSequentially();
        } else {
            await uploadImageToImgBB(selectedImages[0]);
        }
    } catch (error) {
        console.error('Upload failed:', error);
        if (typeof showToast === 'function') {
            showToast('Failed to upload images', '❌');
        }
    } finally {
        uploadInProgress = false;
        isUploadingMultiple = false;
        if (typeof showLoading === 'function') {
            showLoading(false);
        }
    }
}

async function uploadMultipleImagesSequentially() {
    console.log(`Uploading ${selectedImages.length} images sequentially`);

    const totalImages = selectedImages.length;
    let uploadedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < selectedImages.length; i++) {
        try {
            // Update loading text
            if (typeof showLoading === 'function') {
                showLoading(true, `Uploading ${i + 1}/${totalImages} images...`);
            }

            console.log(`Uploading image ${i + 1}/${totalImages}:`, selectedImages[i].name);
            
            await uploadImageToImgBB(selectedImages[i]);
            uploadedCount++;
            
            console.log(`✅ Image ${i + 1} uploaded successfully`);
            
        } catch (error) {
            console.error(`❌ Failed to upload image ${i + 1}:`, error);
            failedCount++;
            
            // Continue with next image even if one fails
            continue;
        }
    }

    // Show summary
    if (uploadedCount > 0) {
        let message = `Successfully sent ${uploadedCount} image${uploadedCount > 1 ? 's' : ''}`;
        if (failedCount > 0) {
            message += `, ${failedCount} failed`;
        }
        
        if (typeof showToast === 'function') {
            showToast(message, uploadedCount > 0 ? '✅' : '⚠️', 3000);
        }
    }
}

// ====================
// IMAGE UPLOAD TO IMGBB - NO AUTO DELETE
// ====================
async function uploadImageToImgBB(file) {
    console.log('uploadImageToImgBB called with file:', file?.name || 'unknown');

    if (!file) {
        console.error('❌ uploadImageToImgBB: File is null');
        throw new Error('No image file selected');
    }

    if (!file.name || file.name === 'unknown' || !file.type || typeof file.size === 'undefined') {
        console.error('❌ uploadImageToImgBB: Invalid file object:', {
            name: file.name,
            type: file.type,
            size: file.size
        });
        throw new Error('Invalid image file');
    }

    console.log('✅ Starting ImgBB upload for:', file.name);

    try {
        console.log('File details:', {
            name: file.name,
            type: file.type,
            size: file.size + ' bytes'
        });

        const fileCopy = new File([file], file.name, {
            type: file.type,
            lastModified: Date.now()
        });

        let processedFile;
        try {
            processedFile = await compressImage(fileCopy);
            console.log('Compression complete:', processedFile?.name);
        } catch (compressError) {
            console.warn('Compression failed, using original file:', compressError.message);
            processedFile = fileCopy;
        }

        if (!processedFile) {
            console.error('Processed file is null, using original');
            processedFile = fileCopy;
        }

        const formData = new FormData();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', processedFile);
        formData.append('name', `relaytalk_${Date.now()}_${file.name.replace(/\s+/g, '_')}`);

        // ⚠️ IMPORTANT: NO expiration parameter = NO AUTO DELETE
        // DO NOT ADD: formData.append('expiration', '600');

        const url = 'https://api.imgbb.com/1/upload';
        console.log('Uploading to ImgBB...');

        const timeout = isMobileChrome() || isIOSChrome() ? 45000 : 25000;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('Upload timeout triggered');
            controller.abort();
        }, timeout);

        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'omit'
        });

        clearTimeout(timeoutId);

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Upload failed:', response.status, errorText);
            throw new Error(`Upload failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('ImgBB response received:', data);

        if (!data.success) {
            console.error('ImgBB API error:', data.error?.message || 'Unknown error');
            throw new Error(data.error?.message || 'Upload failed');
        }

        if (!data.data || !data.data.url) {
            console.error('No URL in response:', data);
            throw new Error('No image URL returned from server');
        }

        let imageUrl = data.data.url;
        let thumbnailUrl = data.data.thumb?.url || data.data.url;

        // Apply URL fixes
        imageUrl = fixImgBBUrls(imageUrl);
        thumbnailUrl = fixImgBBUrls(thumbnailUrl);

        console.log('✅ Image uploaded successfully!');
        console.log('Image URL:', imageUrl);

        await sendImageMessage(imageUrl, thumbnailUrl);

    } catch (error) {
        console.error('Image upload error:', error);

        if (error.name === 'AbortError') {
            console.error('Upload timeout');
            if (typeof showToast === 'function') {
                showToast('Upload timed out. Please check your connection.', '⚠️', 3000);
            }
        } else if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
            console.error('CORS error detected.');
            if (typeof showToast === 'function') {
                showToast('Browser security restriction. Please try again.', '⚠️', 3000);
            }
        } else if (error.message.includes('network')) {
            console.error('Network error detected.');
            if (typeof showToast === 'function') {
                showToast('Network error. Please check your connection.', '⚠️', 3000);
            }
        }

        throw error;
    }
}

// ====================
// IMAGE COMPRESSION
// ====================
async function compressImage(file, maxSize = 1024 * 1024) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file to compress'));
            return;
        }

        if (file.size <= maxSize) {
            console.log('File already small enough, skipping compression');
            resolve(file);
            return;
        }

        console.log('Compressing file from', file.size, 'bytes');

        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();

            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let width = img.width;
                let height = img.height;

                const MAX_DIMENSION = isMobileChrome() || isIOSChrome() ? 1200 : 1600;

                if (width > height && width > MAX_DIMENSION) {
                    height = Math.round((height * MAX_DIMENSION) / width);
                    width = MAX_DIMENSION;
                } else if (height > MAX_DIMENSION) {
                    width = Math.round((width * MAX_DIMENSION) / height);
                    height = MAX_DIMENSION;
                }

                canvas.width = width;
                canvas.height = height;

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = isMobileChrome() ? 'medium' : 'high';
                ctx.drawImage(img, 0, 0, width, height);

                let quality = isMobileChrome() || isIOSChrome() ? 0.75 : 0.85;

                const tryCompress = () => {
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            console.warn('Failed to create blob, using original file');
                            resolve(file);
                            return;
                        }

                        console.log('Compressed to:', blob.size, 'bytes, quality:', quality);

                        if (blob.size <= maxSize || quality <= 0.4) {
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            resolve(compressedFile);
                        } else {
                            quality -= 0.1;
                            tryCompress();
                        }
                    }, 'image/jpeg', quality);
                };

                tryCompress();
            };

            img.onerror = () => {
                console.warn('Failed to load image for compression, using original');
                resolve(file);
            };

            img.src = e.target.result;
        };

        reader.onerror = () => {
            console.warn('Failed to read file for compression, using original');
            resolve(file);
        };

        reader.readAsDataURL(file);
    });
}

// ====================
// SEND IMAGE MESSAGE
// ====================

async function sendImageMessage(imageUrl, thumbnailUrl) {
    console.log('Sending image message to Supabase');

    if (window.isSending) {
        console.log('Already sending a message, please wait');
        return;
    }

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const chatFriend = window.getChatFriend ? window.getChatFriend() : null;
    const supabaseClient = window.getSupabaseClient ? window.getSupabaseClient() : supabase;

    if (!currentUser || !chatFriend || !supabaseClient) {
        console.error('Missing required data for sending image');
        if (typeof showToast === 'function') {
            showToast('Cannot send image - missing user data', '❌');
        }
        return;
    }

    window.isSending = true;
    console.log('✅ Starting to send image message');

    const sendBtn = document.getElementById('sendBtn');
    const originalHTML = sendBtn ? sendBtn.innerHTML : '';

    try {
        if (sendBtn) {
            sendBtn.innerHTML = `
                <svg class="send-icon" viewBox="0 0 24 24" style="opacity: 0.5">
                    <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
                </svg>
            `;
            sendBtn.disabled = true;
        }

        const messageData = {
            sender_id: currentUser.id,
            receiver_id: chatFriend.id,
            content: '',
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl,
            created_at: new Date().toISOString()
        };

        console.log('Sending message data with URLs:', {
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl
        });

        if (selectedColor) {
            messageData.color = selectedColor;
            console.log('Adding color to message:', selectedColor);
            selectedColor = null;
            window.selectedColor = null;
        }

        const { data, error } = await supabaseClient
            .from('direct_messages')
            .insert(messageData)
            .select()
            .single();

        if (error) {
            console.error('Supabase insert error:', error);
            throw error;
        }

        console.log('✅ Image message sent to database:', data.id);

        if (typeof playSentSound === 'function') {
            playSentSound();
        }

        document.getElementById('cameraInput').value = '';
        document.getElementById('galleryInput').value = '';

        if (window.isTyping !== undefined) {
            window.isTyping = false;
        }
        if (window.typingTimeout) {
            clearTimeout(window.typingTimeout);
            window.typingTimeout = null;
        }

        if (typeof sendTypingStatus === 'function') {
            sendTypingStatus(false);
        }

        console.log('✅ Image message process complete');

    } catch (error) {
        console.error('Send image failed:', error);
        if (typeof showCustomAlert === 'function') {
            showCustomAlert('Failed to send image: ' + error.message, '❌', 'Error');
        }
    } finally {
        window.isSending = false;
        if (sendBtn) {
            sendBtn.innerHTML = originalHTML;
            sendBtn.disabled = false;
        }

        const input = document.getElementById('messageInput');
        if (input) {
            setTimeout(() => input.focus(), 100);
        }
    }
}

// ====================
// IMAGE MESSAGE HTML CREATOR
// ====================
function createImageMessageHTML(msg, isSent, colorAttr, time) {
    let imageUrl = msg.image_url || '';
    let thumbnailUrl = msg.thumbnail_url || imageUrl;
    const content = msg.content || '';

    // Apply URL fixes
    imageUrl = fixImgBBUrls(imageUrl);
    thumbnailUrl = fixImgBBUrls(thumbnailUrl);

    return `
        <div class="message ${isSent ? 'sent' : 'received'} image-message" data-message-id="${msg.id}" ${colorAttr}>
            <div class="message-image-container" onclick="viewImageFullscreen('${imageUrl}')">
                <img src="${thumbnailUrl}" 
                     alt="Shared image" 
                     class="message-image"
                     onload="handleImageLoad(this)"
                     onerror="handleImageError(this, '${imageUrl}')"
                     loading="${isMobileChrome() || isIOSChrome() ? 'lazy' : 'eager'}"
                     decoding="async">
                <div class="image-overlay">
                    <svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: white;">
                        <path d="M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5L11,16.5L14.5,12L19,18H5L8.5,13.5Z"/>
                    </svg>
                </div>
            </div>
            ${content ? `
                <div class="image-caption">${content}</div>
            ` : ''}
            <div class="message-time">${time}</div>
        </div>
    `;
}

// ====================
// IMAGE LOADING HANDLERS
// ====================

function handleImageLoad(imgElement) {
    console.log('Image loaded successfully');
    imgElement.style.opacity = '1';
    imgElement.classList.add('loaded');

    if (isMobileChrome() || isIOSChrome()) {
        imgElement.style.transform = 'translateZ(0)';
    }
}

function handleImageError(imgElement, originalUrl) {
    console.error('Failed to load image:', originalUrl);

    let fixedUrl = fixImgBBUrls(originalUrl);

    if (fixedUrl !== originalUrl) {
        console.log('Retrying with fixed URL:', fixedUrl);
        imgElement.src = fixedUrl;
        return;
    }

    fixedUrl = ensureHttpsUrl(originalUrl);
    if (fixedUrl !== originalUrl) {
        console.log('Retrying with HTTPS URL:', fixedUrl);
        imgElement.src = fixedUrl;
        return;
    }

    imgElement.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24"><path fill="%23ccc" d="M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5L11,16.5L14.5,12L19,18H5L8.5,13.5Z"/></svg>';
    imgElement.style.opacity = '1';
    imgElement.classList.add('loaded');

    if (typeof showToast === 'function') {
        showToast('Failed to load image', '⚠️', 1500);
    }
}

// ====================
// IMAGE VIEWER FUNCTIONS
// ====================
function viewImageFullscreen(imageUrl) {
    const existingViewer = document.getElementById('imageViewerOverlay');
    if (existingViewer) existingViewer.remove();

    let fixedImageUrl = fixImgBBUrls(imageUrl);

    const viewerHTML = `
        <div class="image-viewer-overlay" id="imageViewerOverlay">
            <button class="viewer-close" onclick="closeImageViewer()">
                <svg viewBox="0 0 24 24">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
            </button>
            <div class="viewer-image-container">
                <img src="${fixedImageUrl}" alt="Shared image" class="viewer-image" 
                     onload="this.style.opacity='1'; this.classList.add('loaded')"
                     onerror="handleImageViewerError(this, '${fixedImageUrl}')">
            </div>
            <div class="viewer-actions">
                <button class="viewer-action-btn" onclick="downloadImage('${fixedImageUrl}')">
                    <svg viewBox="0 0 24 24">
                        <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
                    </svg>
                    <span>Download</span>
                </button>
                <button class="viewer-action-btn" onclick="shareImage('${fixedImageUrl}')">
                    <svg viewBox="0 0 24 24">
                        <path d="M18,16.08C17.24,16.08 16.56,16.38 16.04,16.85L8.91,12.7C8.96,12.47 9,12.24 9,12C9,11.76 8.96,11.53 8.91,11.3L15.96,7.19C16.5,7.69 17.21,8 18,8A3,3 0 0,0 21,5A3,3 0 0,0 18,2A3,3 0 0,0 15,5C15,5.24 15.04,5.47 15.09,5.7L8.04,9.81C7.5,9.31 6.79,9 6,9A3,3 0 0,0 3,12A3,3 0 0,0 6,15C6.79,15 7.5,14.69 8.04,14.19L15.16,18.34C15.11,18.55 15.08,18.77 15.08,19C15.08,20.61 16.39,21.91 18,21.91C19.61,21.91 20.92,20.61 20.92,19C20.92,17.39 19.61,16.08 18,16.08Z"/>
                    </svg>
                    <span>Share</span>
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', viewerHTML);

    setTimeout(() => {
        const viewer = document.getElementById('imageViewerOverlay');
        if (viewer) viewer.style.opacity = '1';

        if (isMobileChrome() || isIOSChrome()) {
            viewer.addEventListener('touchmove', function(e) {
                e.preventDefault();
            }, { passive: false });
        }
    }, 10);
}

function handleImageViewerError(imgElement, originalUrl) {
    console.error('Failed to load image in viewer:', originalUrl);

    let fixedUrl = fixImgBBUrls(originalUrl);
    if (fixedUrl !== originalUrl) {
        imgElement.src = fixedUrl;
        return;
    }

    fixedUrl = ensureHttpsUrl(originalUrl);
    if (fixedUrl !== originalUrl) {
        imgElement.src = fixedUrl;
        return;
    }

    imgElement.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24"><path fill="%23ccc" d="M21,19V5C21,3.9 20.1,3 19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19M8.5,13.5L11,16.5L14.5,12L19,18H5L8.5,13.5Z"/></svg>';
    imgElement.style.opacity = '1';
    imgElement.classList.add('loaded');
}

function closeImageViewer() {
    const viewer = document.getElementById('imageViewerOverlay');
    if (viewer) {
        viewer.style.opacity = '0';
        setTimeout(() => viewer.remove(), 150);
    }
}

function downloadImage(imageUrl) {
    let downloadUrl = ensureHttpsUrl(imageUrl);
    
    // Extract filename from URL or create a timestamped one
    let filename = 'relaytalk-image-' + Date.now() + '.jpg';
    
    // Try to get filename from URL
    try {
        const urlParts = downloadUrl.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        if (lastPart && lastPart.includes('.') && lastPart.length < 100) {
            filename = lastPart.split('?')[0]; // Remove query parameters
        }
    } catch (e) {
        console.log('Using default filename');
    }
    
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.target = '_blank';
    link.style.display = 'none';
    
    // Add to document and trigger click
    document.body.appendChild(link);
    
    // Force download by using click and then revoke URL
    link.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(link);
        // Try to revoke object URL if it's a blob
        if (downloadUrl.startsWith('blob:')) {
            URL.revokeObjectURL(downloadUrl);
        }
    }, 100);

    if (typeof showToast === 'function') {
        showToast('Download started', '📥', 1500);
    }
}

async function shareImage(imageUrl) {
    // First try to download the image and share as file
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'relaytalk-image.jpg', { type: blob.type });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Image from RelayTalk',
                text: 'Check out this image shared on RelayTalk!'
            });
            return;
        }
    } catch (error) {
        console.log('File sharing not supported, falling back to URL sharing');
    }

    // Fallback to URL sharing
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Image from RelayTalk',
                text: 'Check out this image shared on RelayTalk!',
                url: imageUrl
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                copyToClipboard(imageUrl);
            }
        }
    } else {
        copyToClipboard(imageUrl);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            if (typeof showToast === 'function') {
                showToast('Image URL copied!', '📋', 1500);
            }
        })
        .catch(() => {
            if (typeof showToast === 'function') {
                showToast('Cannot copy URL', '⚠️', 1500);
            }
        });
}

console.log('✅ Image handler functions exported - MULTI-IMAGE SUPPORT 🎉💯');