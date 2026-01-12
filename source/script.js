// @Akmal
// Note: all code here is run through this app to prettify it further 

// CONFIG
const CONFIG = {
    // LM Studio API Settings
    API_URL: 'http://localhost:1234/v1/chat/completions',
    MODEL_NAME: 'openai/gpt-oss-20b',

    // API Parameters
    TEMPERATURE: 0.3,
    MAX_TOKENS: 4096,

    // System Prompts
    SYSTEM_PROMPTS: {
        prettify: `        
You are a code formatting engine. Format the user's code and respond with ONLY valid JSON, no other text.

Rules:
- Identify the programming language
- Apply standard indentation and remove clutter
- Do not change variable names or logic
- comment main headers appropriately to enhance readability

You MUST respond with this exact JSON schema:
{"language": "<detected language>", "formatted_code": "<the formatted code as a single string with \\n for newlines>", "changes_made": <true or false>}

IMPORTANT: Escape all quotes and newlines in the code string properly for valid JSON.
`,

        structure: `
You are a Senior Software Architect. Reorganize the user's code and respond with ONLY valid JSON, no other text.

Rules:
- Move imports/dependencies to the top
- Group related methods/logic
- Standardize naming conventions where obviously inconsistent
- comment main headers appropriately to enhance readability

You MUST respond with this exact JSON schema:
{"language": "<detected language>", "structured_code": "<the restructured code as a single string with \\n for newlines>", "architect_notes": "<brief summary of improvements>"}

IMPORTANT: Escape all quotes and newlines in the code string properly for valid JSON.
`
    }
};

// Main Class
class OpalEditor {
    // Constructor
    constructor() {
        this.codeEditor = document.getElementById('codeEditor');
        this.fileInput = document.getElementById('fileInput');
        this.fileUploadArea = document.getElementById('fileUploadArea');
        this.fileInfo = document.getElementById('fileInfo');
        this.clearFileBtn = document.getElementById('clearFileBtn');
        this.prettifyBtn = document.getElementById('prettifyBtn');
        this.structureBtn = document.getElementById('structureBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.editorWrapper = document.getElementById('editorWrapper');
        this.editorStatus = document.getElementById('editorStatus');
        this.toastContainer = document.getElementById('toastContainer');

        // Modal elements
        this.exportModal = document.getElementById('exportModal');
        this.modalCloseBtn = document.getElementById('modalCloseBtn');
        this.cancelExportBtn = document.getElementById('cancelExportBtn');
        this.confirmExportBtn = document.getElementById('confirmExportBtn');
        this.fileNameInput = document.getElementById('fileName');
        this.fileExtensionSelect = document.getElementById('fileExtension');
        this.customExtensionGroup = document.getElementById('customExtensionGroup');
        this.customExtensionInput = document.getElementById('customExtension');

        // Progress modal elements
        this.progressModal = document.getElementById('progressModal');
        this.progressTitle = document.getElementById('progressTitle');
        this.progressText = document.getElementById('progressText');

        this.currentFile = null;
        this.isProcessing = false;
        this.editor = null;

        this.init();
    }

    // Initialization
    init() {
        this.initCodeMirror();
        this.setupEventListeners();
        this.setupDragAndDrop();
    }

    initCodeMirror() {
        this.editor = CodeMirror.fromTextArea(this.codeEditor, {
            lineNumbers: true,
            mode: 'javascript',
            theme: 'dracula',
            lineWrapping: true,
            viewportMargin: Infinity,
            htmlMode: true,
            matchBrackets: true,
            autoCloseBrackets: true
        });

        this.editor.on('change', () => {
            this.updateEditorStatus();
        });
    }

    setupEventListeners() {
        // Editor events
        // Note: CodeMirror handles scrolling and input internally

        // File input events
        this.fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });

        // Clear file button
        this.clearFileBtn.addEventListener('click', () => {
            this.clearFile();
        });

        // AI button events
        this.prettifyBtn.addEventListener('click', () => {
            this.processAI('prettify');
        });

        this.structureBtn.addEventListener('click', () => {
            this.processAI('structure');
        });

        // Export button
        this.exportBtn.addEventListener('click', () => {
            this.showExportModal();
        });

        // Modal events
        this.modalCloseBtn.addEventListener('click', () => {
            this.hideExportModal();
        });

        this.cancelExportBtn.addEventListener('click', () => {
            this.hideExportModal();
        });

        this.confirmExportBtn.addEventListener('click', () => {
            this.exportCode();
        });

        // Close modal on overlay click
        this.exportModal.addEventListener('click', (e) => {
            if (e.target === this.exportModal) {
                this.hideExportModal();
            }
        });

        // Custom extension toggle
        this.fileExtensionSelect.addEventListener('change', () => {
            this.customExtensionGroup.style.display =
                this.fileExtensionSelect.value === 'custom' ? 'flex' : 'none';
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.showExportModal();
                        break;
                    case 'Enter':
                        e.preventDefault();
                        this.processAI('prettify');
                        break;
                }
            }
        });
    }

    setupDragAndDrop() {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        // Handle dropped files
        document.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFileSelect(files);
        }, false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    async handleFileSelect(files) {
        if (files.length === 0) return;

        const file = files[0];
        this.currentFile = file;

        try {
            const content = await this.readFile(file);
            this.editor.setValue(content);
            this.updateFileInfo(file.name);
            this.updateEditorStatus('File loaded');
            this.showToast('success', `File "${file.name}" loaded successfully`);
        } catch (error) {
            this.showToast('error', 'Failed to read file');
            console.error('File read error:', error);
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('File read failed'));
            reader.readAsText(file);
        });
    }

    clearFile() {
        this.currentFile = null;
        this.editor.setValue('');
        this.fileInfo.style.display = 'none';
        this.updateEditorStatus('Ready');
        this.showToast('success', 'File cleared');
    }

    updateFileInfo(fileName) {
        this.fileInfo.style.display = 'flex';
        this.fileInfo.querySelector('.file-name').textContent = fileName;
    }


    updateEditorStatus(status) {
        if (status) { // Allow overriding status manually
            this.editorStatus.textContent = status;
        }

        // Update status color based on content
        if (this.editor.getValue().trim()) {
            if (!status || status === 'Ready') {
                this.editorStatus.textContent = 'Ready';
            }
            this.editorStatus.style.background = 'rgba(34, 197, 94, 0.1)';
            this.editorStatus.style.color = 'var(--color-success)';
        } else {
            this.editorStatus.textContent = 'Empty';
            this.editorStatus.style.background = 'rgba(148, 163, 184, 0.1)';
            this.editorStatus.style.color = 'var(--color-text-secondary)';
        }
    }

    async processAI(type) {
        const code = this.editor.getValue().trim();
        if (!code) {
            this.showToast('warning', 'Please enter some code first');
            return;
        }

        if (this.isProcessing) {
            this.showToast('warning', 'Processing already in progress');
            return;
        }

        this.isProcessing = true;
        this.setButtonLoading(type, true);
        this.setProcessingState(true);
        this.showProgressModal(type);

        try {
            const processedCode = await this.callLMStudio(code, type);
            this.editor.setValue(processedCode);

            const message = type === 'prettify' ? 'Code prettified successfully' : 'Code restructured successfully';
            this.showToast('success', message);

        } catch (error) {
            this.showToast('error', `Failed to ${type} code: ${error.message}`);
        } finally {
            this.setButtonLoading(type, false);
            this.setProcessingState(false);
            this.hideProgressModal();
            this.isProcessing = false;
        }
    }

    showProgressModal(type) {
        const titles = {
            prettify: 'Prettifying Code...',
            structure: 'Restructuring Code...'
        };
        const texts = {
            prettify: 'AI is formatting your code',
            structure: 'AI is reorganizing your code'
        };
        this.progressTitle.textContent = titles[type] || 'Processing...';
        this.progressText.textContent = texts[type] || 'AI is transforming your code';
        this.progressModal.style.display = 'flex';
    }

    hideProgressModal() {
        this.progressModal.style.display = 'none';
    }

    async callLMStudio(code, type) {
        const systemPrompt = CONFIG.SYSTEM_PROMPTS[type];

        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: CONFIG.MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: code }
                ],
                temperature: CONFIG.TEMPERATURE,
                max_tokens: CONFIG.MAX_TOKENS
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        // Parse JSON response from LLM
        let parsed;
        let jsonStr = content;

        // Remove markdown code blocks if present
        const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
        }

        try {
            parsed = JSON.parse(jsonStr);
        } catch (e) {
            console.error('Failed to parse LLM response:', content);
            throw new Error('Invalid JSON response from model');
        }

        // Return the appropriate code field based on type
        if (type === 'prettify') {
            return parsed.formatted_code;
        } else {
            // Show architect notes as toast
            if (parsed.architect_notes) {
                this.showToast('success', parsed.architect_notes);
            }
            return parsed.structured_code;
        }
    }

    setButtonLoading(type, loading) {
        const button = type === 'prettify' ? this.prettifyBtn : this.structureBtn;
        const text = button.querySelector('.button-text');
        const animation = button.querySelector('.loading-animation');

        if (loading) {
            text.style.display = 'none';
            animation.style.display = 'flex';
            button.disabled = true;
        } else {
            text.style.display = 'inline';
            animation.style.display = 'none';
            button.disabled = false;
        }
    }

    setProcessingState(processing) {
        if (processing) {
            this.editorWrapper.classList.add('processing');
            this.updateEditorStatus('Processing...');
        } else {
            this.editorWrapper.classList.remove('processing');
            this.updateEditorStatus('Ready');
        }
    }

    showExportModal() {
        // Pre-fill filename if we have a current file
        if (this.currentFile) {
            const nameWithoutExt = this.currentFile.name.replace(/\.[^/.]+$/, '');
            this.fileNameInput.value = nameWithoutExt;

            // Set extension based on current file
            const extension = this.currentFile.name.split('.').pop();
            if (extension) {
                this.fileExtensionSelect.value = extension.toLowerCase();
            }
        }

        this.exportModal.style.display = 'flex';
        this.fileNameInput.focus();
    }

    hideExportModal() {
        this.exportModal.style.display = 'none';
    }

    async exportCode() {
        const fileName = this.fileNameInput.value.trim();
        let extension = this.fileExtensionSelect.value;

        if (extension === 'custom') {
            extension = this.customExtensionInput.value.trim().replace(/^\./, '');
            if (!extension) {
                this.showToast('warning', 'Please enter a custom extension');
                return;
            }
        }

        if (!fileName) {
            this.showToast('warning', 'Please enter a file name');
            return;
        }

        const fullFileName = `${fileName}.${extension}`;
        const code = this.editor.getValue();

        // save dialog
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: fullFileName,
                    types: [{
                        description: 'Code Files',
                        accept: { 'text/plain': [`.${extension}`] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(code);
                await writable.close();

                this.hideExportModal();
                this.showToast('success', `File saved successfully`);
                return;
            } catch (err) {
                if (err.name === 'AbortError') {
                    return; // User cancelled
                }
                // Fall through to normal download
            }
        }

        // fallback: normal download
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fullFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.hideExportModal();
        this.showToast('success', `File "${fullFileName}" exported successfully`);
    }

    showToast(type, message) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.toastContainer.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }
}

// Initialize the editor when loaded
document.addEventListener('DOMContentLoaded', () => {
    new OpalEditor();
});

// Add some demo content for initial testing
window.addEventListener('load', () => {
    const demoCode = `
// Welcome to Opal Code Editor
// A minimalist code editor with AI Organization features

// Try the Prettify button to clean up formatting
// Try the Structure button to restructure the code professionally

function hello(name){
console.log("Hello, "+name+"!");
}

const data=[1,2,3,4,5];

for(let i=0;i<data.length;i++){
console.log(data[i]);
}

const express=require('express');
const fs=require('fs');
import React from 'react';
import { useState } from 'react';

function processUserData(user){
return{
...user,
created:new Date(),
active:true
};
}

export { processUserData };
`;

    // Only add demo code if editor is empty
    const editor = document.querySelector('.CodeMirror').CodeMirror;
    if (!editor.getValue().trim()) {
        editor.setValue(demoCode);
    }
});