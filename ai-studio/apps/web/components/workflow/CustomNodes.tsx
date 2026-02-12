"use client";

import React, { memo, useState, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { Settings, Image as ImageIcon, Box, Type, Zap, Maximize, Save, Upload, Activity, Eye } from 'lucide-react';

// --- Design System ---
const colors = {
    nodeBg: '#1e1e24',
    headerBg: '#2a2a35',
    inputBg: '#121217',
    border: '#3f3f4e',
    text: '#ececf1',
    textMuted: '#9ca3af',
    accent: '#6366f1',
    handles: '#ffffff'
};

const styles = {
    node: {
        background: colors.nodeBg,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        minWidth: '240px',
        maxWidth: '320px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.15)',
        color: colors.text,
        fontSize: '12px',
        // overflow: 'hidden' // Removed to allow handles to show
    },
    header: (color: string) => ({
        background: color, // ComfyUI style: solid header color
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontWeight: 600,
        fontSize: '13px',
        borderBottom: `1px solid rgba(0,0,0,0.2)`,
        borderTopLeftRadius: '7px', // Match parent minus border
        borderTopRightRadius: '7px'
    }),
    body: {
        padding: '12px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px'
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '4px'
    },
    label: {
        color: colors.textMuted,
        fontSize: '11px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        fontWeight: 500
    },
    input: {
        background: colors.inputBg,
        border: `1px solid ${colors.border}`,
        borderRadius: '4px',
        padding: '6px 8px',
        color: colors.text,
        fontSize: '12px',
        width: '100%',
        outline: 'none',
        transition: 'border-color 0.2s',
    },
    handle: {
        width: '10px',
        height: '10px',
        background: colors.handles,
        border: '2px solid #1e1e24',
        borderRadius: '50%'
    }
};

const getNodeStyle = (data: any, customOffsetStyle?: any) => ({
    ...styles.node,
    ...customOffsetStyle,
    border: data.executing ? `2px solid ${colors.accent}` : `1px solid ${colors.border}`,
    boxShadow: data.executing
        ? `0 0 20px rgba(99, 102, 241, 0.4), 0 4px 6px -1px rgba(0, 0, 0, 0.3)`
        : styles.node.boxShadow,
    transition: 'all 0.2s ease-in-out'
});


// Enhanced hook to support key-value or object updates
const useUpdateNodeData = (id: string) => {
    const { setNodes } = useReactFlow();
    return (keyOrObj: string | Record<string, any>, value?: any) => {
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    const updates = typeof keyOrObj === 'string' ? { [keyOrObj]: value } : keyOrObj;
                    return { ...node, data: { ...node.data, ...updates } };
                }
                return node;
            })
        );
    };
};

// --- Reusable Components ---

const NodeHeader = ({ label, color, icon: Icon }: any) => (
    <div style={styles.header(color)}>
        <Icon size={14} style={{ opacity: 0.8 }} />
        <span>{label}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
        </div>
    </div>
);

const IOHandle = ({ type, position, color = colors.handles, label, id }: any) => (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '10px' }}>
        <Handle
            type={type}
            position={position}
            id={id}
            style={{
                ...styles.handle,
                background: color,
                [position === Position.Left ? 'left' : 'right']: '-6px' // Keep inside
            }}
        />
        {label && (
            <span style={{
                fontSize: '10px',
                color: colors.textMuted,
                position: 'absolute',
                [position === Position.Left ? 'left' : 'right']: '14px', // Offset to prevent overlap with handle
                whiteSpace: 'nowrap'
            }}>
                {label}
            </span>
        )}
    </div>
);

// --- Nodes ---

export const LoadModelNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="Load Checkpoint" color="#6366f1" icon={Box} />
            <div style={styles.body}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Checkpoint Name</label>
                    <select
                        value={data.model || ""}
                        onChange={(e) => updateData('model', e.target.value)}
                        style={{ ...styles.input, cursor: 'pointer' }}
                    >
                        {data.models === undefined ? (
                            <option value="">Loading models...</option>
                        ) : (
                            <>
                                <option value="" disabled>Select Checkpoint</option>
                                {data.models.length > 0 ? (
                                    data.models.map((m: any) => (
                                        <option key={m.id} value={m.file_path}>{m.name}</option>
                                    ))
                                ) : (
                                    <option disabled>No checkpoints found</option>
                                )}
                            </>
                        )}
                    </select>
                </div>
                {/* Visual outputs */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '14px' }}>
                        <IOHandle type="source" position={Position.Right} label="MODEL" color="#6366f1" id="model" />
                        <IOHandle type="source" position={Position.Right} label="CLIP" color="#fbbf24" id="clip" />
                        <IOHandle type="source" position={Position.Right} label="VAE" color="#ef4444" id="vae" />
                    </div>
                </div>
            </div>
        </div>
    );
});
LoadModelNode.displayName = 'LoadModelNode';

export const PromptNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="CLIP Text Encode (Prompt)" color="#a855f7" icon={Type} />
            <div style={{ ...styles.body, position: 'relative' }}>
                <div style={styles.inputGroup}>
                    <textarea
                        placeholder="Enter positive prompt..."
                        defaultValue={data.prompt || ""}
                        onChange={(e) => updateData('prompt', e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()} // Prevent ReactFlow shortcuts
                        style={{
                            ...styles.input,
                            minHeight: '100px',
                            resize: 'vertical',
                            fontFamily: 'monospace',
                            lineHeight: '1.4'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <IOHandle type="target" position={Position.Left} label="CLIP" color="#fbbf24" id="clip" />
                    <IOHandle type="source" position={Position.Right} label="CONDITIONING" color="#a855f7" id="conditioning" />
                </div>
            </div>
        </div>
    );
});
PromptNode.displayName = 'PromptNode';

export const SamplerNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="KSampler" color="#ef4444" icon={Settings} />
            <div style={styles.body}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Seed</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <input
                                type="number"
                                defaultValue={0}
                                style={styles.input}
                            />
                            <button style={{ ...styles.input, width: 'auto' }}>🎲</button>
                        </div>
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Steps ({data.steps || 20})</label>
                        <input
                            type="range"
                            min={1} max={100}
                            defaultValue={data.steps || 20}
                            onChange={(e) => updateData('steps', parseInt(e.target.value))}
                            style={{ width: '100%', accentColor: '#ef4444', height: '4px' }}
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>CFG ({data.cfg || 7.5})</label>
                        <input
                            type="range"
                            min={1} max={30} step={0.5}
                            defaultValue={data.cfg || 7.5}
                            onChange={(e) => updateData('cfg', parseFloat(e.target.value))}
                            style={{ width: '100%', accentColor: '#ef4444', height: '4px' }}
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Sampler Name</label>
                        <select style={styles.input}>
                            <option>euler_a</option>
                            <option>dpmpp_2m</option>
                            <option>ddim</option>
                        </select>
                    </div>
                </div>

                {data.progress !== undefined && data.progress > 0 && data.progress < 100 && (
                    <div style={{
                        width: '100%',
                        height: '4px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        marginTop: '10px'
                    }}>
                        <div style={{
                            width: `${data.progress}%`,
                            height: '100%',
                            background: colors.accent,
                            transition: 'width 0.2s ease-out'
                        }} />
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', height: '60px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <IOHandle type="target" position={Position.Left} label="MODEL" color="#6366f1" id="model" />
                        <IOHandle type="target" position={Position.Left} label="POSITIVE" color="#a855f7" id="positive" />
                        <IOHandle type="target" position={Position.Left} label="NEGATIVE" color="#a855f7" id="negative" />
                        <IOHandle type="target" position={Position.Left} label="LATENT" color="#ec4899" id="latent_in" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <IOHandle type="source" position={Position.Right} label="LATENT" color="#ec4899" id="latent_out" />
                    </div>
                </div>
            </div>
        </div>
    );
});
SamplerNode.displayName = 'SamplerNode';

export const OutputNode = memo(({ data }: any) => {
    return (
        <div style={getNodeStyle(data, { minWidth: '300px' })}>
            <NodeHeader label="Save Image" color="#22c55e" icon={Save} />
            <div style={{ padding: '0px' }}> {/* No padding for image area */}
                <div style={{
                    width: '100%',
                    minHeight: '300px',
                    background: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: `1px solid ${colors.border}`
                }}>
                    {data.image ? (
                        <img src={data.image} alt="Generated" style={{ width: '100%', height: 'auto', display: 'block' }} />
                    ) : (
                        <div style={{ textAlign: 'center', color: colors.textMuted }}>
                            <ImageIcon size={48} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
                            <div style={{ fontSize: '11px' }}>
                                {data.executing ? 'Executing...' : 'Waiting for latent decode...'}
                            </div>
                        </div>
                    )}
                </div>
                <div style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Filename Prefix</label>
                        <input type="text" defaultValue="ComfyUI" style={styles.input} />
                    </div>
                </div>

                <div style={{ position: 'absolute', left: 0, top: '50%' }}>
                    <IOHandle type="target" position={Position.Left} label="IMAGES" color="#22c55e" id="images" />
                </div>
            </div>
        </div>
    );
});
OutputNode.displayName = 'OutputNode';

export const LoRANode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="Load LoRA" color="#fbbf24" icon={Zap} />
            <div style={styles.body}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>LoRA Name</label>
                    <select
                        value={data.lora_name || ""}
                        onChange={(e) => updateData('lora_name', e.target.value)}
                        style={styles.input}
                    >
                        {data.loras === undefined ? (
                            <option value="">Loading models...</option>
                        ) : (
                            <>
                                <option value="" disabled>Select LoRA</option>
                                {data.loras.length > 0 ? (
                                    data.loras.map((m: any) => (
                                        <option key={m.id} value={m.file_path}>{m.name}</option>
                                    ))
                                ) : (
                                    <option disabled>No LoRAs found</option>
                                )}
                            </>
                        )}
                    </select>
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Strength Model</label>
                    <input
                        type="number"
                        defaultValue={data.strength_model || 1.0}
                        onChange={(e) => updateData('strength_model', parseFloat(e.target.value))}
                        style={styles.input}
                    />
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Strength Clip</label>
                    <input
                        type="number"
                        defaultValue={data.strength_clip || 1.0}
                        onChange={(e) => updateData('strength_clip', parseFloat(e.target.value))}
                        style={styles.input}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <IOHandle type="target" position={Position.Left} label="MODEL" id="model_in" />
                        <IOHandle type="target" position={Position.Left} label="CLIP" id="clip_in" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
                        <IOHandle type="source" position={Position.Right} label="MODEL" id="model_out" />
                        <IOHandle type="source" position={Position.Right} label="CLIP" id="clip_out" />
                    </div>
                </div>
            </div>
        </div>
    );
});
LoRANode.displayName = 'LoRANode';

export const LoadImageNode = memo(({ id, data }: any) => {
    // Hooks should be called at the top level
    const updateData = useUpdateNodeData(id);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Read file
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = event.target?.result as string;
                // Batch update state
                // Use the new object-based update support in useUpdateNodeData
                if (typeof updateData === 'function') {
                    // Check if updateData supports object (it should with recent hook update)
                    // If TS complains, we can cast or just rely on runtime js
                    // To be safe and backward compatible with existing hook signature logic in runtime:
                    // The hook update made it support object as first arg.
                    updateData({
                        image: result,
                        filename: file.name
                    });
                }
            };
            reader.readAsDataURL(file);

            // Reset input value to allow re-uploading same file
            e.target.value = '';
        }
    };

    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="Load Image" color="#f59e0b" icon={Upload} />
            <div style={{ ...styles.body, padding: 0 }}>
                <div
                    className="nodrag" // crucial for interaction inside node
                    style={{
                        width: '100%',
                        height: '160px',
                        background: '#0c0c10',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: `1px solid ${colors.border}`,
                        cursor: 'pointer',
                        position: 'relative'
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                    }}
                >
                    {data.image ? (
                        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                            <img
                                src={data.image}
                                alt="Loaded"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                            <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                padding: '4px',
                                background: 'rgba(0,0,0,0.6)',
                                color: 'white',
                                fontSize: '10px',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {data.filename || 'image.png'}
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', color: colors.textMuted }}>
                            <Upload size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                            <div style={{ fontSize: '11px' }}>Click to upload</div>
                        </div>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                </div>

                <div style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
                            <IOHandle type="source" position={Position.Right} label="IMAGE" color="#fbbf24" id="image" />
                            <IOHandle type="source" position={Position.Right} label="MASK" color="#ef4444" id="mask" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
LoadImageNode.displayName = 'LoadImageNode';

export const ControlNetNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="Apply ControlNet" color="#10b981" icon={Activity} />
            <div style={styles.body}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>ControlNet Model</label>
                    <select
                        value={data.model || ""}
                        onChange={(e) => updateData('model', e.target.value)}
                        style={styles.input}
                    >
                        {data.controlnets === undefined ? (
                            <option value="">Loading models...</option>
                        ) : (
                            <>
                                <option value="" disabled>Select ControlNet</option>
                                {data.controlnets.length > 0 ? (
                                    data.controlnets.map((m: any) => (
                                        <option key={m.id} value={m.file_path}>{m.name}</option>
                                    ))
                                ) : (
                                    <option disabled>No ControlNets found</option>
                                )}
                            </>
                        )}
                    </select>
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Strength</label>
                    <input
                        type="range"
                        min={0} max={2} step={0.05}
                        defaultValue={data.strength || 1.0}
                        onChange={(e) => updateData('strength', parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#10b981', height: '4px' }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <IOHandle type="target" position={Position.Left} label="CONDITIONING" color="#a855f7" id="conditioning_in" />
                        <IOHandle type="target" position={Position.Left} label="IMAGE" color="#fbbf24" id="image" />
                    </div>
                    <IOHandle type="source" position={Position.Right} label="CONDITIONING" color="#a855f7" id="conditioning_out" />
                </div>
            </div>
        </div>
    );
});
ControlNetNode.displayName = 'ControlNetNode';

export const UpscaleNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="Image Upscale" color="#0ea5e9" icon={Maximize} />
            <div style={styles.body}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Upscale Method</label>
                    <select
                        value={data.upscale_method || "bilinear"}
                        onChange={(e) => updateData('upscale_method', e.target.value)}
                        style={styles.input}
                    >
                        <option value="nearest-exact">nearest-exact</option>
                        <option value="bilinear">bilinear</option>
                        <option value="area">area</option>
                    </select>
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Scale Factor</label>
                    <input
                        type="number"
                        defaultValue={data.upscale_factor || 2.0}
                        onChange={(e) => updateData('upscale_factor', parseFloat(e.target.value))}
                        style={styles.input}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <IOHandle type="target" position={Position.Left} label="IMAGE" id="image_in" />
                    <IOHandle type="source" position={Position.Right} label="IMAGE" id="image_out" />
                </div>
            </div>
        </div>
    );
});
UpscaleNode.displayName = 'UpscaleNode';

export const EmptyLatentImageNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="Empty Latent Image" color="#ec4899" icon={Box} />
            <div style={styles.body}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Width</label>
                        <input
                            type="number"
                            defaultValue={data.width || 512}
                            onChange={(e) => updateData('width', parseInt(e.target.value))}
                            style={styles.input}
                            step={64}
                        />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Height</label>
                        <input
                            type="number"
                            defaultValue={data.height || 512}
                            onChange={(e) => updateData('height', parseInt(e.target.value))}
                            style={styles.input}
                            step={64}
                        />
                    </div>
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Batch Size</label>
                    <input
                        type="number"
                        defaultValue={data.batch_size || 1}
                        onChange={(e) => updateData('batch_size', parseInt(e.target.value))}
                        style={styles.input}
                        min={1} max={8}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <IOHandle type="source" position={Position.Right} label="LATENT" color="#ec4899" id="latent" />
                </div>
            </div>
        </div>
    );
});
EmptyLatentImageNode.displayName = 'EmptyLatentImageNode';

export const VAEEncodeNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="VAE Encode" color="#ef4444" icon={Zap} />
            <div style={styles.body}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <IOHandle type="target" position={Position.Left} label="pixels" color="#fbbf24" id="pixels" />
                        <IOHandle type="target" position={Position.Left} label="vae" color="#ef4444" id="vae" />
                    </div>
                    <IOHandle type="source" position={Position.Right} label="LATENT" color="#ec4899" id="latent" />
                </div>
            </div>
        </div>
    );
});
VAEEncodeNode.displayName = 'VAEEncodeNode';

export const VAEDecodeNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="VAE Decode" color="#ef4444" icon={Zap} />
            <div style={styles.body}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <IOHandle type="target" position={Position.Left} label="samples" color="#ec4899" id="samples" />
                        <IOHandle type="target" position={Position.Left} label="vae" color="#ef4444" id="vae" />
                    </div>
                    <IOHandle type="source" position={Position.Right} label="IMAGE" color="#fbbf24" id="image" />
                </div>
            </div>
        </div>
    );
});
VAEDecodeNode.displayName = 'VAEDecodeNode';

export const FaceSwapNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="Face Swap (Reactor)" color="#8b5cf6" icon={Activity} />
            <div style={styles.body}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Face Model</label>
                    <select
                        defaultValue={data.model || "inswapper_128"}
                        onChange={(e) => updateData('model', e.target.value)}
                        style={styles.input}
                    >
                        <option value="inswapper_128">inswapper_128.onnx</option>
                        <option value="codeformer">CodeFormer</option>
                    </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <IOHandle type="target" position={Position.Left} label="IMAGE" color="#fbbf24" id="image_in" />
                        <IOHandle type="target" position={Position.Left} label="FACE" color="#fbbf24" id="face" />
                    </div>
                    <IOHandle type="source" position={Position.Right} label="IMAGE" color="#fbbf24" id="image_out" />
                </div>
            </div>
        </div>
    );
});
FaceSwapNode.displayName = 'FaceSwapNode';

export const InpaintNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="Inpaint VAE" color="#f59e0b" icon={Zap} />
            <div style={styles.body}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Mask Blur</label>
                    <input
                        type="number"
                        defaultValue={data.blur || 4}
                        onChange={(e) => updateData('blur', parseInt(e.target.value))}
                        style={styles.input}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <IOHandle type="target" position={Position.Left} label="pixels" color="#fbbf24" id="pixels" />
                        <IOHandle type="target" position={Position.Left} label="vae" color="#ef4444" id="vae" />
                        <IOHandle type="target" position={Position.Left} label="mask" color="#fbbf24" id="mask" />
                    </div>
                    <IOHandle type="source" position={Position.Right} label="LATENT" color="#ec4899" id="latent" />
                </div>
            </div>
        </div>
    );
});
InpaintNode.displayName = 'InpaintNode';

export const LatentUpscaleNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="Latent Upscale" color="#ec4899" icon={Maximize} />
            <div style={styles.body}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Upscale Method</label>
                    <select
                        value={data.upscale_method || "nearest-exact"}
                        onChange={(e) => updateData('upscale_method', e.target.value)}
                        style={styles.input}
                    >
                        <option>nearest-exact</option>
                        <option>bilinear</option>
                        <option>area</option>
                        <option>bicubic</option>
                    </select>
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Width</label>
                    <input type="number" defaultValue={data.width || 1024} onChange={(e) => updateData('width', parseInt(e.target.value))} style={styles.input} step={64} />
                    <label style={styles.label}>Height</label>
                    <input type="number" defaultValue={data.height || 1024} onChange={(e) => updateData('height', parseInt(e.target.value))} style={styles.input} step={64} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <IOHandle type="target" position={Position.Left} label="SAMPLES" color="#ec4899" id="samples" />
                    <IOHandle type="source" position={Position.Right} label="SAMPLES" color="#ec4899" id="samples_out" />
                </div>
            </div>
        </div>
    );
});
LatentUpscaleNode.displayName = 'LatentUpscaleNode';

export const ConditioningAverageNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="Conditioning Average" color="#a855f7" icon={Activity} />
            <div style={styles.body}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Strength</label>
                    <input type="range" min={0} max={1} step={0.01} defaultValue={data.strength || 0.5} onChange={(e) => updateData('strength', parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#a855f7' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <IOHandle type="target" position={Position.Left} label="conditioning_to" id="to" />
                        <IOHandle type="target" position={Position.Left} label="conditioning_from" id="from" />
                    </div>
                    <IOHandle type="source" position={Position.Right} label="CONDITIONING" id="out" />
                </div>
            </div>
        </div>
    );
});
ConditioningAverageNode.displayName = 'ConditioningAverageNode';

export const SVDLoaderNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="SVD Conditioning" color="#f43f5e" icon={Box} />
            <div style={styles.body}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>FPS</label>
                        <input type="number" defaultValue={data.fps || 12} onChange={(e) => updateData('fps', parseInt(e.target.value))} style={styles.input} />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Frames</label>
                        <input type="number" defaultValue={data.video_frames || 25} onChange={(e) => updateData('video_frames', parseInt(e.target.value))} style={styles.input} />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Motion Bucket ID</label>
                        <input type="number" defaultValue={data.motion_bucket_id || 127} onChange={(e) => updateData('motion_bucket_id', parseInt(e.target.value))} style={styles.input} />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Augmentation</label>
                        <input type="number" defaultValue={data.augmentation_level || 0.0} step={0.01} onChange={(e) => updateData('augmentation_level', parseFloat(e.target.value))} style={styles.input} />
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <IOHandle type="target" position={Position.Left} label="CLIP VISION" color="#fbbf24" id="clip_vision" />
                        <IOHandle type="target" position={Position.Left} label="VAE" color="#ef4444" id="vae" />
                        <IOHandle type="target" position={Position.Left} label="IMAGE" color="#fbbf24" id="init_image" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
                        <IOHandle type="source" position={Position.Right} label="POSITIVE" color="#a855f7" id="positive" />
                        <IOHandle type="source" position={Position.Right} label="NEGATIVE" color="#a855f7" id="negative" />
                        <IOHandle type="source" position={Position.Right} label="LATENT" color="#ec4899" id="latent" />
                    </div>
                </div>
            </div>
        </div>
    );
});
SVDLoaderNode.displayName = 'SVDLoaderNode';

export const VideoLinearCFGNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="Video Linear CFG" color="#10b981" icon={Zap} />
            <div style={styles.body}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Min CFG</label>
                    <input type="number" defaultValue={data.min_cfg || 1.0} step={0.1} onChange={(e) => updateData('min_cfg', parseFloat(e.target.value))} style={styles.input} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <IOHandle type="target" position={Position.Left} label="MODEL" color="#6366f1" id="model" />
                    <IOHandle type="source" position={Position.Right} label="MODEL" color="#6366f1" id="model_out" />
                </div>
            </div>
        </div>
    );
});
VideoLinearCFGNode.displayName = 'VideoLinearCFGNode';

export const ClipVisionLoaderNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label="CLIP Vision Loader" color="#fbbf24" icon={Eye} />
            <div style={styles.body}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>CLIP Vision Model</label>
                    <select
                        value={data.model || ""}
                        onChange={(e) => updateData('model', e.target.value)}
                        style={styles.input}
                    >
                        <option value="">Select Model</option>
                        <option value="clip_vision_g.safetensors">clip_vision_g.safetensors</option>
                        <option value="clip_vision_vit_l.safetensors">clip_vision_vit_l.safetensors</option>
                        <option value="clip_vision_vit_h.safetensors">clip_vision_vit_h.safetensors</option>
                    </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <IOHandle type="source" position={Position.Right} label="CLIP_VISION" color="#fbbf24" id="clip_vision" />
                </div>
            </div>
        </div>
    );
});
ClipVisionLoaderNode.displayName = 'ClipVisionLoaderNode';

export const VideoCombineNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data, { minWidth: '300px' })}>
            <NodeHeader label="Video Combine" color="#22c55e" icon={Save} />
            <div style={{ padding: '0px' }}>
                <div style={{
                    width: '100%',
                    minHeight: '200px',
                    background: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '0 0 4px 4px',
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    {data.preview ? (
                        <video
                            src={data.preview}
                            controls
                            autoPlay
                            loop
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    ) : (
                        <div style={{ color: '#444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Activity size={48} />
                            <span>Video Preview</span>
                        </div>
                    )}
                </div>
                <div style={styles.body}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Format</label>
                        <select
                            defaultValue={data.format || "video/h264-mp4"}
                            onChange={(e) => updateData('format', e.target.value)}
                            style={styles.input}
                        >
                            <option value="video/h264-mp4">H.264 MP4</option>
                            <option value="image/gif">GIF</option>
                            <option value="image/webp">WebP</option>
                        </select>
                    </div>
                </div>
                <div style={{ position: 'absolute', left: 0, top: '50%' }}>
                    <IOHandle type="target" position={Position.Left} label="IMAGES" color="#22c55e" id="images" />
                </div>
            </div>
        </div>
    );
});
VideoCombineNode.displayName = 'VideoCombineNode';

export const WanLoaderNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label={data.label || "Wan 2.1 I2V"} color="#ec4899" icon={Box} />
            <div style={styles.body}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Width</label>
                        <input type="number" defaultValue={data.width || 832} onChange={(e) => updateData('width', parseInt(e.target.value))} style={styles.input} />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Height</label>
                        <input type="number" defaultValue={data.height || 480} onChange={(e) => updateData('height', parseInt(e.target.value))} style={styles.input} />
                    </div>
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Frames</label>
                    <input type="number" defaultValue={data.video_frames || 81} onChange={(e) => updateData('video_frames', parseInt(e.target.value))} style={styles.input} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <IOHandle type="target" position={Position.Left} label="POS" color="#a855f7" id="positive" />
                        <IOHandle type="target" position={Position.Left} label="NEG" color="#a855f7" id="negative" />
                        <IOHandle type="target" position={Position.Left} label="VAE" color="#ef4444" id="vae" />
                        <IOHandle type="target" position={Position.Left} label="IMAGE" color="#fbbf24" id="start_image" />
                        <IOHandle type="target" position={Position.Left} label="CLIP_VIS" color="#fbbf24" id="clip_vision_output" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
                        <IOHandle type="source" position={Position.Right} label="POS" color="#a855f7" id="positive" />
                        <IOHandle type="source" position={Position.Right} label="NEG" color="#a855f7" id="negative" />
                        <IOHandle type="source" position={Position.Right} label="LATENT" color="#ec4899" id="latent" />
                    </div>
                </div>
            </div>
        </div>
    );
});
WanLoaderNode.displayName = 'WanLoaderNode';

export const UNETLoaderNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label={data.label || "UNET Loader"} color="#6366f1" icon={Box} />
            <div style={styles.body}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Model</label>
                    <input type="text" value={data.model || ''} onChange={(e) => updateData('model', e.target.value)} style={styles.input} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <IOHandle type="source" position={Position.Right} label="MODEL" color="#6366f1" id="model" />
                </div>
            </div>
        </div>
    );
});
UNETLoaderNode.displayName = 'UNETLoaderNode';

export const CLIPLoaderNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label={data.label || "CLIP Loader"} color="#fbbf24" icon={Type} />
            <div style={styles.body}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Model</label>
                    <input type="text" value={data.model || ''} onChange={(e) => updateData('model', e.target.value)} style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Type</label>
                    <select value={data.clip_type || 'wan'} onChange={(e) => updateData('clip_type', e.target.value)} style={styles.input}>
                        <option value="wan">wan</option>
                        <option value="sd1">sd1</option>
                        <option value="sdxl">sdxl</option>
                    </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <IOHandle type="source" position={Position.Right} label="CLIP" color="#fbbf24" id="clip" />
                </div>
            </div>
        </div>
    );
});
CLIPLoaderNode.displayName = 'CLIPLoaderNode';

export const VAELoaderNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label={data.label || "VAE Loader"} color="#ef4444" icon={Box} />
            <div style={styles.body}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>VAE Model</label>
                    <input type="text" value={data.model || ''} onChange={(e) => updateData('model', e.target.value)} style={styles.input} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <IOHandle type="source" position={Position.Right} label="VAE" color="#ef4444" id="vae" />
                </div>
            </div>
        </div>
    );
});
VAELoaderNode.displayName = 'VAELoaderNode';

export const CLIPVisionEncodeNode = memo(({ id, data }: any) => {
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label={data.label || "CLIP Vision Encode"} color="#fbbf24" icon={Eye} />
            <div style={styles.body}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <IOHandle type="target" position={Position.Left} label="CLIP_VISION" color="#fbbf24" id="clip_vision" />
                        <IOHandle type="target" position={Position.Left} label="IMAGE" color="#fbbf24" id="image" />
                    </div>
                    <IOHandle type="source" position={Position.Right} label="CLIP_VIS_OUT" color="#fbbf24" id="clip_vision_output" />
                </div>
            </div>
        </div>
    );
});
CLIPVisionEncodeNode.displayName = 'CLIPVisionEncodeNode';

export const WanVideoSamplerNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label={data.label || "Wan Video Sampler"} color="#ec4899" icon={Box} />
            <div style={styles.body}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Steps</label>
                    <input type="number" defaultValue={data.steps || 30} onChange={(e) => updateData('steps', parseInt(e.target.value))} style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>CFG</label>
                    <input type="number" step="0.1" defaultValue={data.cfg || 6.0} onChange={(e) => updateData('cfg', parseFloat(e.target.value))} style={styles.input} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <IOHandle type="target" position={Position.Left} label="MODEL" color="#6366f1" id="model" />
                        <IOHandle type="target" position={Position.Left} label="POS" color="#a855f7" id="positive" />
                        <IOHandle type="target" position={Position.Left} label="NEG" color="#a855f7" id="negative" />
                        <IOHandle type="target" position={Position.Left} label="LATENT" color="#ec4899" id="latent" />
                    </div>
                    <IOHandle type="source" position={Position.Right} label="LATENT" color="#ec4899" id="latent" />
                </div>
            </div>
        </div>
    );
});
WanVideoSamplerNode.displayName = 'WanVideoSamplerNode';

export const WanEmptyLatentNode = memo(({ id, data }: any) => {
    const updateData = useUpdateNodeData(id);
    return (
        <div style={getNodeStyle(data)}>
            <NodeHeader label={data.label || "Wan Empty Latent"} color="#ec4899" icon={Box} />
            <div style={styles.body}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Width</label>
                        <input type="number" defaultValue={data.width || 832} onChange={(e) => updateData('width', parseInt(e.target.value))} style={styles.input} />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Height</label>
                        <input type="number" defaultValue={data.height || 480} onChange={(e) => updateData('height', parseInt(e.target.value))} style={styles.input} />
                    </div>
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Frames</label>
                    <input type="number" defaultValue={data.video_frames || 81} onChange={(e) => updateData('video_frames', parseInt(e.target.value))} style={styles.input} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <IOHandle type="source" position={Position.Right} label="LATENT" color="#ec4899" id="latent" />
                </div>
            </div>
        </div>
    );
});
WanEmptyLatentNode.displayName = 'WanEmptyLatentNode';

