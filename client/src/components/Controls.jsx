import React, { useEffect, useState } from 'react'
import { fetchQuestions, fetchAnswer, API_BASE } from '../api'
export default function Controls({ isPlaying, onPlay, onPause }){
    return (
    <div className="toolbar" role="toolbar" aria-label="Visualization controls">
    {!isPlaying ? (
    <button className="button" onClick={onPlay}>▶ Play</button>
    ) : (
    <button className="button" onClick={onPause}>⏸ Pause</button>
    )}
    </div>
    )
    }