import { useStore } from '../store'

export function Welcome(): JSX.Element {
  const { config, chooseVault, seed } = useStore()
  const hasEmptyVault = Boolean(config?.vaultPath)

  return (
    <div className="welcome">
      <div className="welcome-card">
        <span className="logo">📓</span>
        <h1>Solace</h1>
        <p>
          Your notebooks live in a normal folder on your Mac — plain Markdown files you always own.
          Pick where that folder should be.
        </p>
        {hasEmptyVault ? (
          <>
            <p style={{ color: 'var(--faint)', fontSize: 13 }}>
              This folder is empty. Start with a few example notebooks, or add your own.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn accent" onClick={() => seed()}>
                Add example notebooks
              </button>
              <button
                className="btn"
                onClick={async () => {
                  const snapshot = await window.solace.scanVault()
                  useStore.setState({ snapshot, route: { name: 'shelf' } })
                }}
              >
                Start empty
              </button>
            </div>
            <button className="btn ghost" onClick={() => chooseVault()}>
              Choose a different folder
            </button>
          </>
        ) : (
          <button className="btn accent" onClick={() => chooseVault()}>
            Choose a folder
          </button>
        )}
      </div>
    </div>
  )
}
