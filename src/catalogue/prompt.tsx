// Fenêtre de saisie (adresse du serveur, jeton, recherche) : le clavier de Steam
// s'ouvre sur le champ.
import { ConfirmModal, showModal, TextField } from "@decky/ui";
import { useState } from "react";
import { ct } from "./i18n";

/** Texte saisi, ou null si la fenêtre est annulée. */
export function promptText(title: string, label: string, initial = "", password = false): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    function Prompt({ closeModal }: { closeModal?: () => void }) {
      const [value, setValue] = useState(initial);
      return (
        <ConfirmModal
          strTitle={title}
          strOKButtonText={ct("ok")}
          strCancelButtonText={ct("cancel")}
          onOK={() => {
            finish(value.trim() || null);
            closeModal?.();
          }}
          onCancel={() => {
            finish(null);
            closeModal?.();
          }}
          closeModal={closeModal}
        >
          <TextField label={label} value={value} bIsPassword={password} focusOnMount bShowClearAction onChange={(e) => setValue(e.target.value)} />
        </ConfirmModal>
      );
    }
    showModal(<Prompt />, undefined, { fnOnClose: () => finish(null) });
  });
}
