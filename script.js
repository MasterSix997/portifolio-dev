document.addEventListener('DOMContentLoaded', () => {
    // --- Game of life instances ---
    let golHero = null;

    if (document.getElementById('gameOfLifeCanvasHero')) {
        golHero = new GameOfLife('gameOfLifeCanvasHero', {
            interactionElement: 'hero',

            cellSize: 15,
            cellSpace: 10,
            cellColor: 'rgba(132, 0, 255, 0.82)',
            backgroundColor: 'rgba(9, 5, 15, 0.4)',
	        updateInterval: 100,
        });
    }

    // --- Current year in footer ---
    const currentYearSpan = document.getElementById('currentYear');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    // --- Project Modal ---
    modal = document.getElementById("project-modal");
    modalBody = document.getElementById("modal-body");
    const modalClose = document.getElementById("modal-close");
    const modalOverlay = modal.querySelector(".modal-overlay");

    modalClose.addEventListener("click", closeProjectModal);
    modalOverlay.addEventListener("click", closeProjectModal);

    document.querySelectorAll(".project-card").forEach(card => {
        card.addEventListener("click", () => {
            openProjectModal(card.dataset.projectId);
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !modal.classList.contains("hidden")) {
            closeProjectModal();
        }
    });
});

let modal, modalBody;

function openProjectModal(projectId) {
    fetch(`projects/${projectId}.html`)
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to load project");
            }
            return response.text();
        })
        .then(html => {
            modalBody.innerHTML = html;
            modal.classList.remove("hidden");
            document.body.classList.add("modal-open");
        })
        .catch(error => {
            modalBody.innerHTML = "<p>Failed to load project.</p>";
            modal.classList.remove("hidden");
            document.body.classList.add("modal-open");
            console.error(error);
        });
}

function closeProjectModal() {
    modal.classList.add("hidden");
    modalBody.innerHTML = "";
    document.body.classList.remove("modal-open");
}