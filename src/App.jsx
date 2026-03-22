import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import ramadanBg from "../piyush_10_march_15.jpg";

const STORAGE_KEY = "dzikir-progress-v1";

function readHashSlug() {
    const match = window.location.hash.match(/^#\/ibadah\/([a-z0-9-]+)/i);
    return match ? match[1] : "";
}

function loadProgress() {
    try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch {
        return {};
    }
}

function formatProgress(detail, progressMap) {
    if (!detail?.counters?.length) {
        return "Belum ada target counter";
    }

    const totalCurrent = detail.counters.reduce((sum, counter) => {
        const savedValue = progressMap?.[detail.slug]?.[counter.id] ?? 0;
        return sum + savedValue;
    }, 0);
    const totalGoal = detail.counters.reduce((sum, counter) => sum + counter.goal, 0);

    return `${totalCurrent}/${totalGoal} tercapai`;
}

function App() {
    const [catalogStatus, setCatalogStatus] = useState("loading");
    const [catalog, setCatalog] = useState([]);
    const [query, setQuery] = useState("");
    const [activeSlug, setActiveSlug] = useState(readHashSlug());
    const [detailState, setDetailState] = useState({ status: "idle", data: null, error: "" });
    const [progress, setProgress] = useState(loadProgress);
    const deferredQuery = useDeferredValue(query);

    useEffect(() => {
        let active = true;

        fetch("./data/catalog.json")
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Daftar ibadah gagal dimuat.");
                }

                return response.json();
            })
            .then((data) => {
                if (!active) {
                    return;
                }

                setCatalog(data);
                setCatalogStatus("success");
            })
            .catch((error) => {
                if (!active) {
                    return;
                }

                setCatalogStatus("error");
                setDetailState((current) => current.status === "idle" ? current : current);
                console.error(error);
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const onHashChange = () => {
            startTransition(() => {
                setActiveSlug(readHashSlug());
            });
        };

        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    useEffect(() => {
        if (!activeSlug) {
            setDetailState({ status: "idle", data: null, error: "" });
            return undefined;
        }

        const controller = new AbortController();

        setDetailState({ status: "loading", data: null, error: "" });

        fetch(`./data/ibadah/${activeSlug}.json`, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Halaman ibadah tidak ditemukan.");
                }

                return response.json();
            })
            .then((data) => {
                setDetailState({ status: "success", data, error: "" });
            })
            .catch((error) => {
                if (error.name === "AbortError") {
                    return;
                }

                setDetailState({ status: "error", data: null, error: error.message });
            });

        return () => controller.abort();
    }, [activeSlug]);

    useEffect(() => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }, [progress]);

    const filteredCatalog = useMemo(() => {
        const normalizedQuery = deferredQuery.trim().toLowerCase();

        if (!normalizedQuery) {
            return catalog;
        }

        return catalog.filter((item) => {
            const haystack = [item.title, item.category, item.tagline, ...(item.tags ?? [])]
                .join(" ")
                .toLowerCase();

            return haystack.includes(normalizedQuery);
        });
    }, [catalog, deferredQuery]);

    const featuredCounts = useMemo(() => {
        return catalog.slice(0, 3).map((item) => ({
            ...item,
            progressLabel:
                item.slug === detailState.data?.slug
                    ? formatProgress(detailState.data, progress)
                    : progress?.[item.slug]
                        ? `${Object.values(progress[item.slug]).reduce((sum, value) => sum + value, 0)} dzikir tersimpan`
                        : "Belum dimulai",
        }));
    }, [catalog, detailState.data, progress]);

    function openIbadah(slug) {
        window.location.hash = `#/ibadah/${slug}`;
    }

    function closePanel() {
        const url = new URL(window.location.href);
        url.hash = "";
        window.history.pushState({}, "", url);
        setActiveSlug("");
    }

    function updateCounter(counterId, nextValue) {
        if (!detailState.data) {
            return;
        }

        setProgress((current) => ({
            ...current,
            [detailState.data.slug]: {
                ...current[detailState.data.slug],
                [counterId]: Math.max(0, nextValue),
            },
        }));
    }

    return (
        <div className="app-shell" style={{ "--hero-image": `url(${ramadanBg})` }}>
            <div className="app-backdrop" />
            <main className="page-frame">
                <section className="hero-panel">
                    <div className="hero-copy">
                        <span className="eyebrow">Dzikir Companion</span>
                        <h1>Atur daftar ibadah, cari cepat, lalu lanjutkan hitungan tanpa kehilangan progres.</h1>
                        <p>
                            Tema dibuat selaras dengan nuansa hijau-emas pada referensi. Semua progres counter
                            tersimpan otomatis di local storage, jadi aman untuk deployment di GitHub Pages.
                        </p>
                    </div>

                    <div className="hero-metrics">
                        {featuredCounts.map((item) => (
                            <button key={item.slug} className="metric-card" onClick={() => openIbadah(item.slug)}>
                                <span>{item.title}</span>
                                <strong>{item.progressLabel}</strong>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="content-grid">
                    <div className="catalog-panel">
                        <div className="section-head">
                            <div>
                                <span className="eyebrow">Halaman Utama</span>
                                <h2>Pilih daftar ibadah</h2>
                            </div>
                            <label className="search-box" htmlFor="search-ibadah">
                                <span>Cari ibadah</span>
                                <input
                                    id="search-ibadah"
                                    type="search"
                                    placeholder="Tahajud, sholat wajib, istighfar..."
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                />
                            </label>
                        </div>

                        {catalogStatus === "loading" ? <div className="empty-state">Memuat daftar ibadah...</div> : null}
                        {catalogStatus === "error" ? (
                            <div className="empty-state">Daftar ibadah gagal dimuat. Periksa file JSON katalog.</div>
                        ) : null}

                        {catalogStatus === "success" ? (
                            filteredCatalog.length ? (
                                <div className="catalog-grid">
                                    {filteredCatalog.map((item) => {
                                        const totalSaved = Object.values(progress[item.slug] ?? {}).reduce(
                                            (sum, value) => sum + value,
                                            0,
                                        );

                                        return (
                                            <article key={item.slug} className="ibadah-card">
                                                <div className="ibadah-card__top">
                                                    <span className="chip">{item.category}</span>
                                                    <span className="mini-stat">{totalSaved ? `${totalSaved} tersimpan` : "Baru"}</span>
                                                </div>
                                                <h3>{item.title}</h3>
                                                <p>{item.tagline}</p>
                                                <div className="tag-row">
                                                    {item.tags.map((tag) => (
                                                        <span key={tag} className="tag-row__item">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                                <button className="card-action" onClick={() => openIbadah(item.slug)}>
                                                    Buka halaman ibadah
                                                </button>
                                            </article>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="empty-state">Tidak ada ibadah yang cocok dengan pencarian Anda.</div>
                            )
                        ) : null}
                    </div>

                    <aside className={`detail-panel ${activeSlug ? "detail-panel--open" : ""}`}>
                        {!activeSlug ? (
                            <div className="detail-placeholder">
                                <span className="eyebrow">AJAX Panel</span>
                                <h2>Detail ibadah akan dimuat di sini</h2>
                                <p>
                                    Klik salah satu kartu ibadah di halaman utama. Panel ini akan mengambil data JSON
                                    secara asynchronous dan menampilkan counter yang tersimpan lokal.
                                </p>
                            </div>
                        ) : null}

                        {detailState.status === "loading" ? (
                            <div className="detail-loading">
                                <div className="loading-line loading-line--title" />
                                <div className="loading-line" />
                                <div className="loading-line" />
                                <div className="loading-card" />
                                <div className="loading-card" />
                            </div>
                        ) : null}

                        {detailState.status === "error" ? (
                            <div className="detail-placeholder">
                                <span className="eyebrow">Gagal Memuat</span>
                                <h2>{detailState.error}</h2>
                                <button className="card-action" onClick={closePanel}>
                                    Kembali ke daftar
                                </button>
                            </div>
                        ) : null}

                        {detailState.status === "success" ? (
                            <div className="detail-content">
                                <div className="detail-head">
                                    <div>
                                        <span className="eyebrow">{detailState.data.category}</span>
                                        <h2>{detailState.data.title}</h2>
                                        <p>{detailState.data.description}</p>
                                    </div>
                                    <button className="close-button" onClick={closePanel} aria-label="Tutup panel">
                                        Tutup
                                    </button>
                                </div>

                                <div className="detail-meta">
                                    <div>
                                        <span>Fokus</span>
                                        <strong>{detailState.data.focus}</strong>
                                    </div>
                                    <div>
                                        <span>Waktu terbaik</span>
                                        <strong>{detailState.data.recommendedTime}</strong>
                                    </div>
                                    <div>
                                        <span>Ringkasan progres</span>
                                        <strong>{formatProgress(detailState.data, progress)}</strong>
                                    </div>
                                </div>

                                <section className="steps-block">
                                    <h3>Alur singkat ibadah</h3>
                                    <ol>
                                        {detailState.data.steps.map((step) => (
                                            <li key={step.title}>
                                                <strong>{step.title}</strong>
                                                <p>{step.body}</p>
                                            </li>
                                        ))}
                                    </ol>
                                </section>

                                <section className="counter-block">
                                    <div className="counter-head">
                                        <h3>Counter dzikir</h3>
                                        <p>Setiap perubahan tersimpan otomatis di perangkat ini.</p>
                                    </div>
                                    <div className="counter-list">
                                        {detailState.data.counters.map((counter) => {
                                            const value = progress[detailState.data.slug]?.[counter.id] ?? 0;
                                            const completion = Math.min(100, Math.round((value / counter.goal) * 100));

                                            return (
                                                <article key={counter.id} className="counter-card">
                                                    <div className="counter-card__head">
                                                        <div>
                                                            <h4>{counter.label}</h4>
                                                            <p>{counter.note}</p>
                                                        </div>
                                                        <strong>
                                                            {value}/{counter.goal} {counter.unit}
                                                        </strong>
                                                    </div>

                                                    {counter.arabic && (
                                                        <div className="counter-dzikir">
                                                            <p className="counter-dzikir__arabic" lang="ar" dir="rtl">
                                                                {counter.arabic}
                                                            </p>
                                                            {counter.transliteration && (
                                                                <p className="counter-dzikir__latin">{counter.transliteration}</p>
                                                            )}
                                                            {counter.meaning && (
                                                                <p className="counter-dzikir__meaning">&ldquo;{counter.meaning}&rdquo;</p>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="progress-bar" aria-hidden="true">
                                                        <span style={{ width: `${completion}%` }} />
                                                    </div>

                                                    <div className="counter-actions">
                                                        <button onClick={() => updateCounter(counter.id, value - counter.step)}>-{counter.step}</button>
                                                        <button className="counter-value" onClick={() => updateCounter(counter.id, counter.goal)}>
                                                            Selesaikan
                                                        </button>
                                                        <button onClick={() => updateCounter(counter.id, value + counter.step)}>+{counter.step}</button>
                                                        <button onClick={() => updateCounter(counter.id, 0)}>Reset</button>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>
                        ) : null}
                    </aside>
                </section>
            </main>
        </div>
    );
}

export default App;