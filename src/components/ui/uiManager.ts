export interface UIManager {
    updateCoinCount(count: number): void;
    dispose(): void;
}

export function createUIManager(): UIManager {
    // Create a simple overlay
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "20px";
    container.style.right = "20px";
    container.style.color = "white";
    container.style.fontFamily = "sans-serif";
    container.style.fontSize = "24px";
    container.style.fontWeight = "bold";
    container.style.textShadow = "2px 2px 0 #000";
    container.style.pointerEvents = "none";
    container.style.userSelect = "none";
    container.style.zIndex = "1000";

    const coinIcon = document.createElement("span");
    coinIcon.textContent = "🟡 "; // Gold circle emoji as coin

    const countText = document.createElement("span");
    countText.textContent = "0";

    container.appendChild(coinIcon);
    container.appendChild(countText);
    document.body.appendChild(container);

    let currentCount = 0;

    function updateCoinCount(count: number) {
        currentCount = count;
        countText.textContent = currentCount.toString();
    }

    // Listen for custom event from playerController
    const onCoinCollected = (e: Event) => {
        const customEvent = e as CustomEvent;
        const added = customEvent.detail.count;
        updateCoinCount(currentCount + added);
    };

    window.addEventListener("coinCollected", onCoinCollected);

    function dispose() {
        window.removeEventListener("coinCollected", onCoinCollected);
        if (container.parentElement) {
            container.parentElement.removeChild(container);
        }
    }

    return { updateCoinCount, dispose };
}
