// Tipos del juego y modos (CONTRATOS.md §6). JSDoc puro, sin dependencias de runtime (§1).

/**
 * @typedef {Object} Intent
 * @property {string} type
 * @property {string} [key]
 * @property {*} [value]
 * @property {string} [presetId]
 * @property {string} [name]
 * @property {Array<*>} [args]
 * @property {string} [partId]
 * @property {string} [choiceId]
 * @property {string} [toolId]
 * @property {string} [mark]
 * @property {string} [partType]
 * @property {number} [x]
 * @property {number} [y]
 * @property {string} [from]
 * @property {string} [to]
 * @property {string} [linkId]
 */

/**
 * @typedef {Object} Session
 * @property {import('../core/types.js').Model} model
 * @property {ReturnType<import('../core/loop.js').createLoop>} loop
 * @property {ReturnType<import('../core/history.js').createRecorder>} recorder
 * @property {(realDt: number) => number} tick
 * @property {(cb: (simDt: number, steps: number) => void) => () => void} onFrame
 * @property {() => void} start
 * @property {() => void} stop
 * @property {() => void} reset
 * @property {() => void} destroy
 */

/**
 * @typedef {Object} ModeUi
 * @property {string[]|'all'} controls
 * @property {string[]|'all'|'none'} faults
 * @property {string[]|'all'} readouts
 * @property {'full'|'hints'|'off'} narration
 * @property {boolean} labels
 * @property {boolean} tooltips
 * @property {boolean} infoPanel
 * @property {boolean} presets
 * @property {{ maxScale: number }} timebar
 * @property {{ draggable: boolean, connectable: boolean, palette: string[] }} edit
 * @property {string[]} revealedFaults
 */

/**
 * @typedef {Object} ModeEvent
 * @property {'feedback'|'score'|'stageEnd'|'uiChanged'|'highlight'} type
 * @property {'info'|'good'|'bad'} [level]
 * @property {string} [text]
 * @property {{ partIds?: string[], style?: 'selected'|'correct'|'wrong'|'target' }} [data]
 */

/**
 * @typedef {Object} Stage
 * @property {string} id
 * @property {string} mode
 * @property {string} module
 * @property {string} title
 * @property {string} brief
 * @property {number} seed
 * @property {string[]} [unlockAfter]
 * @property {Object} [config]
 */

/**
 * @typedef {Object} SaveData
 * @property {number} version
 * @property {Record<string, { bestScore: number, stars: number, completedAt: string }>} stages
 * @property {Record<string, { seen: number, correct: number }>} mastery
 */

/**
 * @typedef {Object} SaveApi
 * @property {() => SaveData} get
 * @property {(id: string, result: { score?: number, stars?: number, completedAt?: string }) => Object} recordStage
 * @property {(partType: string, ok: boolean) => Object} recordAnswer
 * @property {() => SaveData} reset
 */

/**
 * @typedef {Object} HudModel
 * @property {string} title
 * @property {string} brief
 * @property {Array<{ label: string, value: string|number }>} stats
 * @property {{ text: string, choices?: Array<{ id: string, label: string }> }} [prompt]
 * @property {Array<{ id: string, label: string, active: boolean, cost: number }>} [tools]
 * @property {Array<{ intent: Intent, label: string, disabled: boolean }>} [actions]
 * @property {Array<{ partId: string, label: string, mark: 'suspect'|'cleared'|null }>} [suspects]
 * @property {Array<{ level: 'info'|'good'|'bad', text: string }>} log
 */

/**
 * @typedef {Object} ModeContext
 * @property {Session} session
 * @property {import('../core/types.js').ModuleDescriptor} module
 * @property {Object|null} stage
 * @property {ReturnType<import('../core/rng.js').createRng>} [rng]
 * @property {Object} [save]
 */

/**
 * @typedef {Object} GameMode
 * @property {string} id
 * @property {ModeUi} ui
 * @property {(intent: Intent) => ModeEvent[]} handle
 * @property {(simDt: number) => ModeEvent[]} update
 * @property {() => HudModel|null} hud
 * @property {'playing'|'won'|'lost'|'free'} status
 * @property {() => void} destroy
 */
