/**
 * help-guide.js - Reusable Help Guide Component
 * Displays context-sensitive help and terminology for all dashboards
 * Language: Norwegian Bokmål
 */

class HelpGuide {
  constructor() {
    this.isOpen = false;
    this.glossary = null;
    this.loadGlossary();
  }

  async loadGlossary() {
    try {
      const response = await fetch('shared-glossary.json');
      this.glossary = await response.json();
    } catch (error) {
      console.warn('Could not load glossary:', error);
      this.glossary = null;
    }
  }

  /**
   * Initialize help button on page load
   */
  initHelpButton() {
    const existingBtn = document.querySelector('.help-button');
    if (existingBtn) return; // Already exists

    const helpBtn = document.createElement('button');
    helpBtn.className = 'help-button';
    helpBtn.setAttribute('title', 'Hjælp og forklaring');
    helpBtn.setAttribute('aria-label', 'Åpne hjælp');
    helpBtn.innerHTML = '?';
    helpBtn.addEventListener('click', () => this.showHelp());

    // Append to header or first available container
    const header = document.querySelector('.header') || 
                   document.querySelector('header') || 
                   document.querySelector('.compact-header') ||
                   document.body;
    
    if (header) {
      header.appendChild(helpBtn);
    }
  }

  /**
   * Show help modal with context-specific content
   */
  showHelp() {
    if (this.isOpen) return;
    this.isOpen = true;

    const dashboardType = this.detectDashboardType();
    const content = this.getHelpContent(dashboardType);

    this.displayModal(content, dashboardType);
  }

  /**
   * Detect which dashboard we're on
   */
  detectDashboardType() {
    const url = window.location.pathname;
    
    if (url.includes('admin') || document.querySelector('.admin-dashboard')) {
      return 'admin';
    } else if (url.includes('facility') || document.querySelector('.facility-dashboard')) {
      return 'facility';
    } else if (url.includes('vessel') || document.querySelector('.vessel-dashboard') || document.getElementById('map')) {
      return 'vessel';
    }
    
    // Fallback: check for specific elements
    if (document.querySelector('.sidebar-left')) return 'facility';
    if (document.querySelector('[id="systemStatus"]')) return 'vessel';
    
    return 'generic';
  }

  /**
   * Get context-specific help content
   */
  getHelpContent(dashboardType) {
    const baseContent = {
      title: '📖 Hvordan lese dashboarden',
      sections: []
    };

    switch(dashboardType) {
      case 'admin':
        return this.getAdminHelp(baseContent);
      case 'facility':
        return this.getFacilityHelp(baseContent);
      case 'vessel':
        return this.getVesselHelp(baseContent);
      default:
        return this.getGenericHelp(baseContent);
    }
  }

  /**
   * Admin dashboard help
   */
  getAdminHelp(baseContent) {
    baseContent.icon = '👨‍💼';
    baseContent.subtitle = 'Oversikt over hele kystsonen';
    baseContent.sections = [
      {
        title: '🎯 Risiko-oversikt',
        content: 'Rød = smittet, Oransje = ILA protection-sone, Amber = ILA surveillance-sone, Gul = lokal smitteradius, Grønn = frisk. Klikk på anlegg for detaljer.'
      },
      {
        title: '📊 Forventet utbrudd',
        content: 'Sortert etter høyeste risiko. Forklaring av score ved å klikka på pil-ikona.'
      },
      {
        title: '🚢 Båtrisiko',
        content: 'Hvem har besøkt hvem. Grønt = klarert, Rød = karantene.'
      },
      {
        title: '💡 Tips',
        content: 'Bruk filterene øverst for å fokusera på spesifikke soner eller risikokategorier.'
      }
    ];
    baseContent.glossary = this.getGlossaryTerms(['smittet', 'BW-sone', 'karantene', 'lokal_smitteradius']);
    return baseContent;
  }

  /**
   * Facility dashboard help
   */
  getFacilityHelp(baseContent) {
    baseContent.icon = '🏭';
    baseContent.subtitle = 'Risikostyring for ditt anlegg';
    baseContent.sections = [
      {
        title: '🔴 Øverst: Din risiko nå',
        content: 'Tre nøkkeltall: smittede innen 15km, næreste avstand, og besøk siste 48t.'
      },
      {
        title: '📍 Midten: Anlegget i området',
        content: 'Interaktivt kart. Drag for å bevege, scroll for å zoome. Klikk anlegg for info.'
      },
      {
        title: '📋 Høyre meny: Navigering',
        content: 'Klikk "Risiko nå", "Anleggsinfo", eller "Handlinger" for å bytte visning.'
      },
      {
        title: '⚡ Handlinger',
        content: 'Logg hendelse, send varsel, opprett karantene, eller generer rapport.'
      },
      {
        title: '💡 Tips',
        content: 'Smitterisikoanalyse viser de 4 viktigste faktorene. Klikk "Hvorfor?" ved risikobadgen for forklaring.'
      }
    ];
    baseContent.glossary = this.getGlossaryTerms(['smittet', 'karantene', 'havstrom', 'besok']);
    return baseContent;
  }

  /**
   * Vessel dashboard help
   */
  getVesselHelp(baseContent) {
    baseContent.icon = '🚢';
    baseContent.subtitle = 'Ruteplanlægning og smitterisikovurdering';
    baseContent.sections = [
      {
        title: '🔍 Velg båt',
        content: 'Skriv MMSI (f.eks. 257051270 for Labridae) og klikk "Last båt".'
      },
      {
        title: '📍 Kart',
        content: 'Grønn = frisk anlegg, Rød = smittet, Oransje = ILA protection-sone, Amber = ILA surveillance-sone. Klikk for å legge til i rute.'
      },
      {
        title: '🛣️ Ruteplanlegger (høyre side)',
        content: 'Legg til og sorter anlegg du vil besøka. Systemet foreslår rute basert på smitterisiko.'
      },
      {
        title: '📅 Helseattest',
        content: 'Grønn = klarert, Rød = i karantene. Du kan ikke besøka røde anlegg within karantenevinduet.'
      },
      {
        title: '💡 Tips',
        content: 'Åpne kalender for å se hvilke datoer som er tillate for hver anlegg.'
      }
    ];
    baseContent.glossary = this.getGlossaryTerms(['smittet', 'karantene', 'BW-sone', 'fritt_anlegg']);
    return baseContent;
  }

  /**
   * Generic help
   */
  getGenericHelp(baseContent) {
    baseContent.icon = '❓';
    baseContent.subtitle = 'Kyst Monitor - Smitterisiko Oversikt';
    baseContent.sections = [
      {
        title: '🎨 Fargekoder',
        content: '🟢 Grønn = Frisk | 🟠 Oransje = ILA protection-sone | 🟧 Amber = ILA surveillance-sone | 🟡 Gul = Lokal smitteradius | 🔴 Rød = Smittet'
      },
      {
        title: '📊 Informasjonslag',
        content: 'Hver dashboard viser relevant informasjon for din rolle. Admin ser hele systemet, anlegger ser seg selv, og båteiere ser rutene.'
      }
    ];
    baseContent.glossary = this.getGlossaryTerms(['smittet', 'karantene', 'lokal_smitteradius']);
    return baseContent;
  }

  /**
   * Get glossary terms
   */
  getGlossaryTerms(termKeys) {
    if (!this.glossary || !this.glossary.glossary) {
      return [];
    }

    return termKeys
      .filter(key => this.glossary.glossary[key])
      .map(key => ({
        term: this.glossary.glossary[key].no,
        definition: this.glossary.glossary[key].definition,
        color: this.glossary.glossary[key].color,
        icon: this.glossary.glossary[key].icon
      }));
  }

  /**
   * Display help modal
   */
  displayModal(content, dashboardType) {
    // Remove existing modal if present
    const existingModal = document.querySelector('.help-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'help-modal help-modal-' + dashboardType;

    let html = `
      <div class="help-modal-overlay"></div>
      <div class="help-modal-dialog">
        <div class="help-modal-header">
          <h2>${content.icon} ${content.title}</h2>
          <p class="help-modal-subtitle">${content.subtitle}</p>
          <button class="help-modal-close" aria-label="Lukk hjælp">&times;</button>
        </div>

        <div class="help-modal-body">
    `;

    // Sections
    if (content.sections && content.sections.length > 0) {
      html += '<div class="help-sections">';
      content.sections.forEach(section => {
        html += `
          <div class="help-section">
            <h3>${section.title}</h3>
            <p>${section.content}</p>
          </div>
        `;
      });
      html += '</div>';
    }

    // Glossary
    if (content.glossary && content.glossary.length > 0) {
      html += `
        <div class="help-glossary">
          <h3>📚 Viktige termer</h3>
          <div class="glossary-items">
      `;
      content.glossary.forEach(item => {
        html += `
          <div class="glossary-item">
            <div class="glossary-item-header">
              <span class="glossary-icon">${item.icon}</span>
              <strong>${item.term}</strong>
              <span class="glossary-color" style="background: ${item.color};" title="Fargekode"></span>
            </div>
            <p class="glossary-definition">${item.definition}</p>
          </div>
        `;
      });
      html += `
          </div>
        </div>
      `;
    }

    html += `
        </div>

        <div class="help-modal-footer">
          <button class="help-modal-ok">OK, jeg skjønner</button>
        </div>
      </div>
    `;

    modal.innerHTML = html;
    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.help-modal-close').addEventListener('click', () => this.closeModal(modal));
    modal.querySelector('.help-modal-ok').addEventListener('click', () => this.closeModal(modal));
    modal.querySelector('.help-modal-overlay').addEventListener('click', () => this.closeModal(modal));

    // Keyboard: Escape to close
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        this.closeModal(modal);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * Close modal
   */
  closeModal(modal) {
    modal.classList.add('help-modal-closing');
    setTimeout(() => {
      modal.remove();
      this.isOpen = false;
    }, 200);
  }
}

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (!window.HelpGuideInstance) {
    window.HelpGuideInstance = new HelpGuide();
    window.HelpGuideInstance.initHelpButton();
  }
});
