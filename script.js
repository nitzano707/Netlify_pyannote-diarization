// משתנים גלובליים
const MAX_SEGMENT_SIZE_MB = 24; // גודל מקטע מקסימלי ב-MB

// משתנים לאחסון התמלול בפורמטים שונים
let estimatedTime = 0;
let transcriptionDataText = '';
let transcriptionDataSRT = '';
let transcriptionData = []; // משתנה גלובלי לשמירת התמלול

let audioFileName = ''; // הוספת המשתנה החסר
const defaultLanguage = 'he'; // שפה ברירת מחדל - עברית

// המשתנה global שנצבר עם הזמן המצטבר הכולל בכל מקטע
let totalElapsedTime = 0;

let firstChunkDuration = 0;

let apiKey = localStorage.getItem('groqApiKey');

document.addEventListener('DOMContentLoaded', () => {
    apiKey = localStorage.getItem('groqApiKey');
    if (!apiKey) {
        document.getElementById('apiRequest').style.display = 'block';
        document.getElementById('apiKeyInput').focus(); // הוספת הפוקוס כאן 
    } else {
        document.getElementById('apiRequest').style.display = 'none';
        document.getElementById('startProcessBtn').style.display = 'block';
       
    }
    document.getElementById('textTab').style.display = 'block';
    document.querySelector("button[onclick*='textTab']").classList.add('active');
    displayTranscription('text');
});


function saveApiKey() {
    const apiKeyInput = document.getElementById('apiKeyInput').value;
    if (apiKeyInput) {
        localStorage.setItem('groqApiKey', apiKeyInput);
        apiKey = apiKeyInput; // עדכון משתנה גלובלי
        document.getElementById('apiRequest').style.display = 'none';
        document.getElementById('startProcessBtn').style.display = 'block';
    }
}


function triggerFileUpload() {
    document.getElementById('audioFile').click();
}

document.getElementById('audioFile').addEventListener('change', function () {
    const fileName = this.files[0] ? this.files[0].name : "לא נבחר קובץ";
    if (this.files[0]) {
        audioFileName = this.files[0].name;
        document.getElementById('fileName').textContent = fileName;
        document.getElementById('uploadBtn').disabled = false;
        // תוספת שלי:
        document.getElementById('uploadBtn').classList.add('start-over');
    } else {
        document.getElementById('fileName').textContent = "לא נבחר קובץ";
        document.getElementById('uploadBtn').disabled = true;
        // תוספת שלי:
        document.getElementById('uploadBtn').classList.remove('start-over');
    }
});

async function uploadAudio() {
   const audioFile = document.getElementById('audioFile').files[0];
   
   if (!audioFile) {
       alert('אנא בחר קובץ להעלאה.');
       return;
   }

   // בדיקת סוג וגודל הקובץ
   const fileType = audioFile.type.toLowerCase();
   const fileExtension = audioFile.name.split('.').pop().toLowerCase();
   const isM4A = fileType.includes('m4a') || fileExtension === 'm4a';
   const isMP4 = fileType.includes('mp4') || fileExtension === 'mp4';
   const sizeInMB = audioFile.size / (1024 * 1024);

   // בדיקת הגבלת גודל רק עבור קבצי M4A
   if (isM4A && sizeInMB > MAX_SEGMENT_SIZE_MB) {
       alert(`קבצי M4A חייבים להיות קטנים מ-${MAX_SEGMENT_SIZE_MB}MB. אנא העלה קובץ קטן יותר או השתמש בפורמט MP3/WAV.`);
       document.getElementById('audioFile').value = ""; 
       document.getElementById('fileName').textContent = "לא נבחר קובץ";
       document.getElementById('uploadBtn').disabled = true;
       return;
   }

    // בדיקת הגבלת גודל רק עבור קבצי MP4
   if (isMP4 && sizeInMB > MAX_SEGMENT_SIZE_MB) {
       alert(`קבצי MP4 חייבים להיות קטנים מ-${MAX_SEGMENT_SIZE_MB}MB. אנא העלה קובץ קטן יותר או השתמש בפורמט MP3/WAV.`);
       document.getElementById('audioFile').value = ""; 
       document.getElementById('fileName').textContent = "לא נבחר קובץ";
       document.getElementById('uploadBtn').disabled = true;
       return;
   }

   // בדיקת סוג הקובץ
   if (!fileType.includes('mp3') && 
       !fileType.includes('wav') && 
       !fileType.includes('m4a') && 
       !fileType.includes('mp4') &&
       !fileExtension === 'mp3' && 
       !fileExtension === 'wav' && 
       !fileExtension === 'mp4' &&
       !fileExtension === 'm4a') {
       alert('פורמט קובץ לא נתמך. אנא השתמש בקובץ בפורמט MP3 | WAV | M4A |.');
       return;
   }

   calculateEstimatedTime();
   
   if (!apiKey) {
       alert('מפתח API חסר. נא להזין מחדש.');
       return;
   }

   openModal('modal3');
   const modal = document.getElementById('modal3');
   if (modal) {
       const modalBody = modal.querySelector('.modal-body p');
       if (modalBody) {
           modalBody.innerHTML = `ברגעים אלה הקובץ <strong>${audioFileName}</strong> עולה ועובר תהליך עיבוד. בסיום התהליך יוצג התמלול`;
       }
   } else {
       console.warn("Modal or modal header not found.");
   }

   // חישוב הערכת זמן מבוסס על גודל הקובץ וסוגו
   let estimatedDurationInMinutes;
   if (fileType.includes('mp3') || fileExtension === 'mp3') {
       estimatedDurationInMinutes = (sizeInMB / 0.96); // הערכה עבור MP3 בקצב של 128 קילובייט לשנייה
   } else if (fileType.includes('wav') || fileExtension === 'wav') {
       estimatedDurationInMinutes = (sizeInMB / 10); // הערכה גסה עבור WAV (לא דחוס)
   } else if (isM4A || isMP4) {
       estimatedDurationInMinutes = (sizeInMB / 0.75); // הערכה עבור M4A או MP4
   }

   // הודעת אזהרה אם סך הדקות מוערך כגדול מ-120 דקות
   if (estimatedDurationInMinutes > 120) {
       alert(`משך הקובץ מוערך כ-${Math.round(estimatedDurationInMinutes)} דקות, ייתכן שהוא יחרוג ממכסת התמלול של 120 דקות לשעה. אנא היוועץ אם להמשיך.`);
   }

   const maxChunkSizeBytes = MAX_SEGMENT_SIZE_MB * 1024 * 1024;
   let  = [];
   let totalTimeElapsed = 0;

   try {
       console.log("Starting to split the audio file into chunks...");
       const chunks = await splitAudioToChunksBySize(audioFile, maxChunkSizeBytes);
       const totalChunks = chunks.length;
       console.log(`Total chunks created: ${totalChunks}`);

       for (let i = 0; i < totalChunks; i++) {
           const chunkFile = new File([chunks[i]], `chunk_${i + 1}.${audioFile.name.split('.').pop()}`, { type: audioFile.type });
           if (i === 0) {
               document.getElementById('progress').style.width = '0%';
               document.getElementById('progressText').textContent = '0%';
           }
           updateProgressBarSmoothly(i + 1, totalChunks, estimatedTime);

           await processAudioChunk(chunkFile, transcriptionData, i + 1, totalChunks, totalTimeElapsed);
           if (chunks[i].duration) {
               totalTimeElapsed += chunks[i].duration;
           }

           await new Promise(resolve => setTimeout(resolve, 500));
       }
   
       saveTranscriptions(transcriptionData, audioFile.name);
       displayTranscription('text');
       closeModal('modal3');
       openModal('modal4');
       const modal4 = document.getElementById('modal4');
       if (modal4) {
           const modalBody = modal4.querySelector('.modal-body p');
           if (modalBody) {
               modalBody.innerHTML = `תמלול הקובץ <strong>${audioFileName}</strong> הושלם`;
           }
       }
   } catch (error) {
       console.error('Error during audio processing:', error);
       closeModal('modal3');
       alert('שגיאה במהלך התמלול. נא לנסות שוב.');
   }
     
}

function copyTranscription() {
    const activeTab = document.querySelector(".tablinks.active");
    if (!activeTab) {
        alert('לא נבחר פורמט להעתקה. נא לבחור פורמט מתמלול.');
        return;
    }
    const format = activeTab.getAttribute('data-format');
    let textToCopy;

    if (format === "text") {
        if (!transcriptionDataText) {
            alert('אין תמלול להעתקה.');
            return;
        }
        textToCopy = transcriptionDataText;
    } else if (format === "srt") {
        if (!transcriptionDataSRT) {
            alert('אין תמלול להעתקה.');
            return;
        }
        textToCopy = transcriptionDataSRT;
    }

    // העתקת התמלול ללוח
    navigator.clipboard.writeText(textToCopy).then(() => {
        // הצגת הודעת פופ-אפ לאחר העתקה מוצלחת
        const copyMessage = document.getElementById('copyMessage');
        if (copyMessage) {
            copyMessage.style.display = 'block';
            setTimeout(() => {
                copyMessage.style.display = 'none';
            }, 2000); // ההודעה תוצג למשך 2 שניות
        } else {
            console.warn("copyMessage element not found in the DOM.");
        }
    }).catch((error) => {
        console.error('Failed to copy text:', error);
        alert('שגיאה בהעתקת הטקסט. נא לנסות שוב.');
    });
}



function resetProcess() {
    // איפוס כל המשתנים הגלובליים
    estimatedTime = 0;
    audioFileName = '';
    transcriptionDataText = '';
    transcriptionDataSRT = '';
    totalElapsedTime = 0;
    firstChunkDuration = 0;

    // איפוס הממשק וחזרה למסך הראשי
    closeModal('modal1');
    closeModal('modal3');
    closeModal('modal4');
    document.getElementById('audioFile').value = "";
    document.getElementById('fileName').textContent = "לא נבחר קובץ";
    document.getElementById('uploadBtn').disabled = true;
    document.getElementById('startProcessBtn').style.display = 'block';
}




async function splitAudioToChunksBySize(file, maxChunkSizeBytes) {
    // אם הקובץ קטן מהמגבלה, אין צורך לפצל
    if (file.size <= maxChunkSizeBytes) {
        return [file];
    }

    // בדיקה גמישה לסוג הקובץ עם שימוש ב-file.type ובשם הקובץ
    const fileType = file.type || '';
    const fileName = file.name || '';

    // בדיקות לפי סוג הקובץ
    if (fileType.includes('wav') || fileName.endsWith('.wav')) {
        console.log("Detected WAV file");
        return splitWavFile(file, maxChunkSizeBytes);
    } else if (fileType.includes('mp3') || fileName.endsWith('.mp3')) {
        console.log("Detected MP3 file");
        return await splitMp3File(file, maxChunkSizeBytes);
    } else {
        throw new Error('פורמט קובץ לא נתמך לפיצול. אנא השתמש בקובץ בפורמט MP3 או WAV.');
    }
}




async function splitWavFile(file, maxChunkSizeBytes) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;
    const totalSizeBytes = file.size;
    const numberOfChunks = Math.ceil(totalSizeBytes / maxChunkSizeBytes);
    const chunkDuration = audioBuffer.duration / numberOfChunks;
    let currentTime = 0;
    const chunks = [];

    while (currentTime < audioBuffer.duration) {
        const end = Math.min(currentTime + chunkDuration, audioBuffer.duration);
        const frameCount = Math.floor((end - currentTime) * sampleRate);
        const chunkBuffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const originalChannelData = audioBuffer.getChannelData(channel);
            const chunkChannelData = chunkBuffer.getChannelData(channel);
            for (let i = 0; i < frameCount; i++) {
                chunkChannelData[i] = originalChannelData[Math.floor(currentTime * sampleRate) + i];
            }
        }

        const blob = bufferToWaveBlob(chunkBuffer);
        if (blob.size > maxChunkSizeBytes) {
            console.warn('Chunk exceeded max size, splitting further');
            // הוספת 5 שניות לסרגל ההתקדמות כאשר מתבצע פיצול נוסף
            estimatedTime += 5;
            const subChunks = await splitWavFile(blob, maxChunkSizeBytes);
            chunks.push(...subChunks);
        } else {
            chunks.push(blob);
        }
        currentTime = end;
    }

    return chunks;
}



async function splitMp3File(file, maxChunkSizeBytes) {
    const chunks = [];
    const totalChunks = Math.ceil(file.size / maxChunkSizeBytes);

    for (let i = 0; i < totalChunks; i++) {
        const start = i * maxChunkSizeBytes;
        const end = Math.min((i + 1) * maxChunkSizeBytes, file.size);
        const chunk = file.slice(start, end);
        if (chunk.size > maxChunkSizeBytes) {
            console.warn('MP3 chunk exceeded max size, splitting further');
            const subChunks = await splitMp3File(chunk, maxChunkSizeBytes);
            chunks.push(...subChunks);
        } else {
            chunks.push(chunk);
        }
    }

    return chunks;
}
    

function bufferToWaveBlob(abuffer) {
    const numOfChan = abuffer.numberOfChannels;
    const length = abuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let offset = 0;
    let pos = 0;

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16);         // PCM format
    setUint16(1);          // format (PCM)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);

    setUint32(0x61746164); // "data" chunk
    setUint32(length - pos - 4);

    for (let i = 0; i < abuffer.numberOfChannels; i++) {
        channels.push(abuffer.getChannelData(i));
    }

    while (pos < length) {
        for (let i = 0; i < numOfChan; i++) {
            const sample = Math.max(-1, Math.min(1, channels[i][offset]));
            view.setInt16(pos, sample < 0 ? sample * 32768 : sample * 32767, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([buffer], { type: "audio/wav" });
}

async function processAudioChunk(chunk, transcriptionData, currentChunk, totalChunks) {
    const formData = new FormData();
    formData.append('file', chunk);
    //formData.append('model', 'whisper-large-v3-turbo');
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'verbose_json'); 
    formData.append('language', defaultLanguage);

    const apiKey = localStorage.getItem('groqApiKey');
    if (!apiKey) {
        alert('מפתח API חסר. נא להזין שוב.');
        location.reload();
        return;
    }

    try {
        console.log(`Sending chunk ${currentChunk} of ${totalChunks} to the API...`);
        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`Received response for chunk ${currentChunk}:`, data);

            if (data.segments) {
                data.segments.forEach((segment) => {
                    if (typeof segment.start === 'number' && typeof segment.end === 'number') {
                        const startTime = formatTimestamp(segment.start + totalElapsedTime);
                        const endTime = formatTimestamp(segment.end + totalElapsedTime);
                        const text = segment.text.trim();

                        transcriptionData.push({
                            text: text,
                            timestamp: `${startTime} --> ${endTime}`
                        });
                    } else {
                        console.warn(`Invalid timestamp for segment:`, segment);
                    }
                });
                    console.log('Current transcriptionData after processing a chunk:', transcriptionData); // לוג כאן
                // עדכון totalElapsedTime לפי זמן הסיום של המקטע האחרון
                const lastSegment = data.segments[data.segments.length - 1];
                if (lastSegment && typeof lastSegment.end === 'number') {
                    totalElapsedTime += lastSegment.end;
                }
            } else {
                console.warn(`Missing segments in response for chunk ${currentChunk}`);
            }
        } else {
            if (response.status === 401) {
                alert('שגיאה במפתח API. נא להזין מפתח חדש.');
                localStorage.removeItem('groqApiKey');
                location.reload();
                return;
            }
            const errorText = await response.text();
            console.error(`Error for chunk ${currentChunk}:`, errorText);
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error && errorData.error.code === 'rate_limit_exceeded') {
                    let waitTime = errorData.error.message.match(/try again in ([\d\w\.]+)/)[1];
                    waitTime = waitTime
                        .replace('s', ' שניות')
                        .replace('m', ' דקות')
                        .replace('h', ' שעות')
                        .replace('d', ' ימים');

                    alert(`מכסת התמלולים שלך לשעה הסתיימה. נא להמתין ${waitTime} ולהתחיל מחדש את התהליך.`);
                    resetProcess();
                    return;
                }
            } catch (parseError) {
                console.warn('Failed to parse error response:', parseError);
            }
        }
    } catch (error) {
        console.error('Network error:', error);
    }
}







function formatTimestamp(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds)) {
        console.error('Invalid seconds value for timestamp:', seconds);
        return '00:00:00,000';
    }
    const date = new Date(seconds * 1000);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const secs = String(date.getUTCSeconds()).padStart(2, '0');
    const millis = String(date.getUTCMilliseconds()).padStart(3, '0');

    return `${hours}:${minutes}:${secs},${millis}`;
}


function saveTranscriptions(data, audioFileName) {
    // const title = `תמלול קובץ אודיו: ${audioFileName}\n\n`; // כותרת עם שם הקובץ
    const title = `תמלול קובץ אודיו: ${audioFileName}  :בוצע באמצעות https://tamleli.netlify.app\n\n`; // כותרת עם שם הקובץ

    // הוספת הכותרת לפני כל תמלול
    transcriptionDataText = title + data.map(d => cleanText(d.text)).join(" ").trim();
    transcriptionDataSRT = title + data.map((d, index) => {
        return `${index + 1}\n${d.timestamp}\n${cleanText(d.text)}\n`;
    }).join("\n\n");
}



function cleanText(text) {
    return text.replace(/\s+/g, ' ').trim();
}

function displayTranscription(format) {
    let transcriptionResult;
    if (format === "text") {
        transcriptionResult = document.getElementById('textContent');
    } else if (format === "srt") {
        transcriptionResult = document.getElementById('srtContent');
    }

    if (!transcriptionResult) return;

    const tabcontent = document.getElementsByClassName("tabcontent");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    transcriptionResult.textContent = (format === "text") ? transcriptionDataText : transcriptionDataSRT;
    transcriptionResult.parentElement.style.display = "block";
}

function cleanText(text) {
    return text.replace(/\s+/g, ' ').trim();
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
}

// פונקציה לבחירת כרטיסיה לתצוגת התמלול (טקסט או SRT)
function openTab(evt, tabName) {
    const tabcontent = document.getElementsByClassName("tabcontent");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    const tablinks = document.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";

    // עדכון התמלול בהתאם לכרטיסיה שנבחרה
    const format = evt.currentTarget.getAttribute('data-format');
    displayTranscription(format);
}

// פונקציה להורדת תמלול
function downloadTranscription() {
    const activeTab = document.querySelector(".tablinks.active");
    if (!activeTab) {
        alert('לא נבחר פורמט להורדה. נא לבחור פורמט מתמלול.');
        return;
    }
    const format = activeTab.getAttribute('data-format');
    let blob, fileName;

    // קיצור שם קובץ האודיו ל-15 תווים לכל היותר, כדי לא ליצור שם ארוך מדי
    const shortAudioFileName = audioFileName.length > 15 ? audioFileName.substring(0, 15) + "..." : audioFileName;

    if (format === "text") {
        if (!transcriptionDataText) {
            alert('אין תמלול להורדה.');
            return;
        }
        blob = new Blob([transcriptionDataText], { type: 'text/plain' });
        fileName = `transcription_${shortAudioFileName}.txt`;
    } else if (format === "srt") {
        if (!transcriptionDataSRT) {
            alert('אין תמלול להורדה.');
            return;
        }
        blob = new Blob([transcriptionDataSRT], { type: 'text/plain' });
        fileName = `transcription_${shortAudioFileName}.srt`;
    }

    //const url = URL.createObjectURL(blob);
   // const a = document.createElement('a');
   // a.href = url;
   // a.download = fileName;
   // document.body.appendChild(a);
   // a.click();
   // document.body.removeChild(a);
   // URL.revokeObjectURL(url);

    // שינוי: שימוש בקישור הורדה קבוע (downloadLink) במקום יצירת אלמנט חדש בכל פעם
        const url = URL.createObjectURL(blob);
        const downloadLink = document.getElementById('downloadLink');
        downloadLink.href = url;
        downloadLink.download = fileName;
        downloadLink.click();
        URL.revokeObjectURL(url);
}


    

// פונקציה לחישוב זמן משוער לפי סוג וגודל הקובץ
function calculateEstimatedTime() {
    const audioFile = document.getElementById('audioFile').files[0];
    if (!audioFile) return;
    const sizeMB = audioFile.size / (1024 * 1024);
    if (audioFile.type.includes('mp3')) {
        estimatedTime = sizeMB * 1; // MP3: 1 שנייה לכל מגה בייט
    } else if (audioFile.type.includes('wav')) {
        estimatedTime = sizeMB * 0.4; // WAV: 0.4 שניות לכל מגה בייט
    } else {
        estimatedTime = sizeMB * 1.5; // ברירת מחדל
    }
}

// פונקציה לעדכון חלק של סרגל ההתקדמות
function updateProgressBarSmoothly(currentChunk, totalChunks, estimatedTime) {
    const progressElement = document.getElementById('progress');
    const progressTextElement = document.getElementById('progressText');
    const interval = estimatedTime / totalChunks * 1000;
    let startProgress = ((currentChunk - 1) / totalChunks) * 100;
    let endProgress = (currentChunk / totalChunks) * 100;
    let currentProgress = startProgress;

    const smoothProgress = setInterval(() => {
        currentProgress += 1;
        if (currentProgress >= endProgress) {
            currentProgress = endProgress;
            clearInterval(smoothProgress);
        }
        progressElement.style.width = `${currentProgress}%`;
        progressTextElement.textContent = `${Math.round(currentProgress)}%`;
    }, interval / (endProgress - startProgress));
}


// פונקציה שמתחילה את תהליך זיהוי הדוברים
function showSpeakerSegmentationModal() {
    openModal('speakerSegmentationModal');
    startProcess(); // התחלת התהליך של זיהוי הדוברים
}


async function startProcess() {
    const audioFile = document.getElementById('audio-file').files[0];  // הקובץ כבר נמצא כאן
    const uploadBtn = document.getElementById('upload-btn');  // במידה וצריך להפעיל כפתור, זה כאן

    if (!audioFile) {
        showStatus('נא לבחור קובץ אודיו', 'error');
        return;
    }

    uploadBtn.disabled = true;
    showStatus('מעלה את הקובץ...', 'info');

    try {
        // שליחת הקובץ לפונקציה בשרת
        const formData = new FormData();
        formData.append('file', audioFile);

        const response = await fetch('/.netlify/functions/diarize', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(`שגיאת שרת: ${JSON.stringify(data, null, 2)}`);
        }

        const data = await response.json();
        
        if (data.jobId) {
            currentJobId = data.jobId;
            showStatus('הקובץ הועלה בהצלחה! מעבד את הקובץ...', 'info');
            startStatusCheck(); // התחל לבדוק את הסטטוס
        } else {
            throw new Error('לא התקבל מזהה עבודה');
        }

    } catch (error) {
        console.error('Error:', error);
        showStatus(`שגיאה: ${error.message}`, 'error');
        uploadBtn.disabled = false;
    }
}


function startStatusCheck() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }

    // התחלת לולאת בדיקת הסטטוס כל 5 שניות
    statusCheckInterval = setInterval(checkStatus, 5000);
}



async function checkStatus() {
    if (!currentJobId) return;

    try {
        const response = await fetch(`/.netlify/functions/check-status?jobId=${currentJobId}`);
        const data = await response.json();

        if (data.status === 'succeeded') {
            clearInterval(statusCheckInterval);
            showStatus('העיבוד הושלם בהצלחה!', 'success');
            displayResults(data.output);  // הצגת התוצאות המתקבלות
            document.getElementById('upload-btn').disabled = false;
            currentJobId = null;
        } else if (data.status === 'failed' || data.status === 'canceled') {
            clearInterval(statusCheckInterval);
            showStatus(`העיבוד נכשל: ${data.error || 'שגיאה לא ידועה'}`, 'error');
            document.getElementById('upload-btn').disabled = false;
            currentJobId = null;
        } else {
            showStatus(`מעבד את הקובץ... סטטוס: ${data.status}`, 'info');
        }
    } catch (error) {
        console.error('Error checking status:', error);
        showStatus('שגיאה בבדיקת סטטוס העיבוד', 'error');
    }
}



function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    if (!results || !results.diarization) {
        resultsDiv.textContent = 'לא נמצאו תוצאות';
        resultsDiv.style.display = 'block';
        return;
    }

    resultsDiv.innerHTML = '<h3>תוצאות זיהוי הדוברים:</h3>';

    results.diarization.forEach(segment => {
        const segmentDiv = document.createElement('div');
        segmentDiv.className = 'speaker-segment';
        segmentDiv.innerHTML = `
            <strong>${segment.speaker}</strong><br>
            ${formatTime(segment.start)} - ${formatTime(segment.end)}
        `;
        resultsDiv.appendChild(segmentDiv);
    });

    resultsDiv.style.display = 'block';
}



function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(1);
    return `${minutes}:${remainingSeconds.padStart(4, '0')}`;
}



function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = ` ${type === 'info' ? '<span class="loading"></span>' : ''} ${message} `;
    statusDiv.className = `status-${type}`;
    statusDiv.style.display = 'block';
}




// עד כאן





async function getSegmentedText(text, prompt) {
    let success = false;
    const maxRetries = 5;
    let retries = 0;

    while (!success && retries < maxRetries) {
        if (!apiKey) {
            throw new Error("API Key not found in local storage.");
        }
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "llama3-70b-8192",
                    messages: [
                        { role: "system", content: prompt },
                        { role: "user", content: text }
                    ],
                    max_tokens: 1024
                })
            });

            if (response.ok) {
                const result = await response.json();
                success = true;
                let segmentedText = result.choices[0].message.content;

                // הוספת ריווח שורה לפני כל דובר חדש
                segmentedText = segmentedText.replace(/(מראיין:|מרואיין:)/g, "\n$1");

                return segmentedText;
            } else {
                const errorText = await response.text();
                const errorData = JSON.parse(errorText);

                if (errorData.error && errorData.error.code === "rate_limit_exceeded") {
                    const waitTime = extractWaitTime(errorText);
                    if (waitTime) {
                        console.log(`מגבלת קצב הושגה. ממתין ${waitTime} שניות לפני ניסיון נוסף...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                    } else {
                        retries++;
                    }
                } else {
                    throw new Error(`שגיאה בבקשה: ${errorText}`);
                }
            }
        } catch (error) {
            console.error("Error with segment:", error);
            retries++;
        }
    }

    throw new Error("לא ניתן היה לבצע חלוקה לדוברים לאחר ניסיונות מרובים.");
}


// פונקציה שמחלצת את זמן ההמתנה מתוך הודעת השגיאה
function extractWaitTime(errorText) {
    const match = errorText.match(/try again in ([\d.]+)s/);
    return match ? parseFloat(match[1]) : null;
}

function splitTextIntoSegments(text, maxChars = 500, maxSentences = 5) {
    const segments = [];
    let currentSegment = "";
    let sentenceCount = 0;

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    for (let sentence of sentences) {
        if ((currentSegment.length + sentence.length > maxChars) || sentenceCount >= maxSentences) {
            segments.push(currentSegment.trim());
            currentSegment = "";
            sentenceCount = 0;
        }

        currentSegment += sentence + " ";
        sentenceCount++;
    }

    if (currentSegment.trim()) {
        segments.push(currentSegment.trim());
    }

    return segments;
}





function splitTextIntoSegments(text, maxChars = 500, maxSentences = 5) {
    const segments = [];
    let currentSegment = "";
    let sentenceCount = 0;

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    for (let sentence of sentences) {
        if ((currentSegment.length + sentence.length > maxChars) || sentenceCount >= maxSentences) {
            segments.push(currentSegment.trim());
            currentSegment = "";
            sentenceCount = 0;
        }

        currentSegment += sentence + " ";
        sentenceCount++;
    }

    if (currentSegment.trim()) {
        segments.push(currentSegment.trim());
    }

    return segments;
}


function copySegmentationResult() {
    const segmentationResult = document.getElementById('segmentationResult').textContent;
    if (segmentationResult) {
        navigator.clipboard.writeText(segmentationResult).then(() => {
            alert('תמלול הועתק בהצלחה!');
        }).catch((error) => {
            console.error('שגיאה בהעתקת הטקסט:', error);
        });
    }
}

function downloadSegmentationResult() {
    const segmentationResult = document.getElementById('segmentationResult').textContent;
    if (segmentationResult) {
        const blob = new Blob([segmentationResult], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'segmentation_result.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}





// פונקציה לאיפוס תהליך ההעלאה והתמלול
function restartProcess() {
    // איפוס כל המשתנים הגלובליים
    estimatedTime = 0;
    audioFileName = '';
    transcriptionDataText = '';
    transcriptionDataSRT = '';
    speakerSegmentationData = ''; // איפוס חלוקה לדוברים
    totalElapsedTime = 0;
    firstChunkDuration = 0;

    // איפוס הממשק וחזרה למסך הראשי
    closeModal('modal1');
    closeModal('modal3');
    closeModal('modal4');
    document.getElementById('audioFile').value = "";
    document.getElementById('fileName').textContent = "לא נבחר קובץ";
    document.getElementById('uploadBtn').disabled = true;
    
    document.getElementById('startProcessBtn').style.display = 'block';

    // הסתרת כפתורי הורדה והעתקה
    document.getElementById('downloadButton').style.display = 'none';
    document.getElementById('copyButton').style.display = 'none';

    // מחיקת תוכן תמלול מחולק לפי דוברים
    document.getElementById("segmentationResult").textContent = "";
    document.getElementById("intervieweeNameInput").value = "";

}
