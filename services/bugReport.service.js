import process from "node:process";
import nodemailer from "nodemailer";
import prisma from "../utils/prisma.js";

/**
 * Creates a bug report in Trello
 * @param {number|string} userId - The ID of the user reporting the bug
 * @param {Object} bugReportData - The data of the bug report
 * @param {Object} reporterInfo - Name and email of the reporter
 * @param {Object} attachment - The file attachment (multer file object)
 */
export const createBugReport = async (userId, bugReportData, reporterInfo, attachment) => {
  const { title, description, severity, stepsToReproduce, pageUrl, userAgent } = bugReportData;
  const { name, email } = reporterInfo;

  const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
  const TRELLO_API_TOKEN = process.env.TRELLO_API_TOKEN;
  const TRELLO_LIST_ID = process.env.TRELLO_LIST_ID;

  if (!TRELLO_API_KEY || !TRELLO_API_TOKEN || !TRELLO_LIST_ID) {
    console.warn("Trello API credentials missing. Bug report not saved to Trello.");
    // Return mock success so the frontend doesn't crash during local development/testing without keys
    return { success: true, cardId: "mock-trello-card-id", warning: "Trello API credentials missing" };
  }

  // Build markdown description
  const desc = `
**Bejelentő:** ${name} (${email})
**Súlyosság:** ${severity}
**Jelentve erről az oldalról:** ${pageUrl || "Ismeretlen"}
**Böngésző / Rendszer:** ${userAgent || "Ismeretlen"}

---
### Leírás
${description}

${stepsToReproduce ? `### Reprodukálás lépései\n${stepsToReproduce}` : ""}
`;

  // 1. Create the Trello Card
  const createCardResponse = await fetch(`https://api.trello.com/1/cards?idList=${TRELLO_LIST_ID}&key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: title || "Új hibabejelentés",
      desc: desc,
      pos: "top"
    })
  });

  if (!createCardResponse.ok) {
    const errorText = await createCardResponse.text();
    console.error("Trello API Error creating card:", errorText);
    throw new Error("Nem sikerült létrehozni a hibajegyet a Trello-ban.");
  }

  const card = await createCardResponse.json();
  const cardId = card.id;

  // 2. Upload attachment if exists
  if (attachment) {
    const formData = new FormData();
    const blob = new Blob([attachment.buffer], { type: attachment.mimetype });
    formData.append("file", blob, attachment.originalname);

    const uploadResponse = await fetch(`https://api.trello.com/1/cards/${cardId}/attachments?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Trello API Error uploading attachment:", errorText);
      // We still return success as the card was created
    }
  }

  // 3. Send email to superadmins
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.example.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER || "user@example.com",
        pass: process.env.SMTP_PASS || "password",
      },
    });

    // Check if SMTP is configured to prevent crash locally
    if (process.env.SMTP_HOST) {
      // Fetch all active superadmins (permissions >= 16 means the superadmin bit is set)
      const superadmins = await prisma.user.findMany({
        where: {
          permissions: { gte: 16 },
          isActive: true
        },
        select: { email: true }
      });
      
      let toEmails = superadmins.map(user => user.email).filter(email => email).join(", ");
      
      // Fallback if no superadmin emails found
      if (!toEmails) {
        toEmails = process.env.BUG_REPORT_EMAIL || process.env.SMTP_USER || "admin@example.com";
      }

      const subjectTitle = title ? title : "Új hibabejelentés";
      const subjectSeverity = severity ? severity : "ismeretlen";
      
      const severityColor = severity === "high" ? "#ffcdd2" : (severity === "medium" ? "#fff9c4" : "#c8e6c8");
      const severityTextColor = severity === "high" ? "#c62828" : (severity === "medium" ? "#f57f17" : "#2e7d32");

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER || '"Indikátor Rendszer" <noreply@example.com>',
        to: process.env.SMTP_FROM || process.env.SMTP_USER || '"Indikátor Rendszer" <noreply@example.com>',
        bcc: toEmails,
        subject: `Indikátor Rendszer - Hibabejelentés - ${subjectSeverity} - ${subjectTitle}`,
        text: desc,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
            <h2 style="color: #d32f2f; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">Új hibabejelentés érkezett</h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; width: 150px;"><strong>Bejelentő:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${name} (<a href="mailto:${email}">${email}</a>)</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Súlyosság:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
                  <span style="background-color: ${severityColor}; color: ${severityTextColor}; padding: 3px 8px; border-radius: 4px; font-size: 14px; font-weight: bold;">
                    ${severity || "ismeretlen"}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>URL:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><a href="${pageUrl || "#"}">${pageUrl || "Ismeretlen"}</a></td>
              </tr>
            </table>

            <h3 style="margin-top: 30px; font-size: 18px;">${subjectTitle}</h3>

            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
              <p style="margin-top: 0; font-weight: bold; font-size: 14px;">Leírás:</p>
              <p style="margin-bottom: 0; white-space: pre-wrap;">${description}</p>
            </div>

            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <p style="margin-top: 0; font-weight: bold; font-size: 14px;">Reprodukálás lépései:</p>
              <p style="margin-bottom: 0; white-space: pre-wrap;">${stepsToReproduce || "Nem adta meg"}</p>
            </div>

            <p style="font-size: 12px; color: #777; margin-top: 30px;">
              <strong>Böngésző / Rendszer:</strong><br>
              ${userAgent || "Ismeretlen"}
            </p>
          </div>
        `,
        attachments: []
      };

      if (attachment) {
        mailOptions.attachments.push({
          filename: attachment.originalname,
          content: attachment.buffer,
          contentType: attachment.mimetype
        });
      }

      await transporter.sendMail(mailOptions);
    } else {
      console.warn("SMTP credentials missing. Bug report email not sent.");
    }
  } catch (emailError) {
    console.error("Error sending bug report email:", emailError);
    // Don't throw, let the bug report creation succeed even if email fails
  }

  return { success: true, cardId };
};

/**
 * Fetches reported bugs from Trello
 * @returns {Array} List of bugs
 */
export const getReportedBugs = async () => {
  const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
  const TRELLO_API_TOKEN = process.env.TRELLO_API_TOKEN;
  const TRELLO_LIST_ID = process.env.TRELLO_LIST_ID;

  if (!TRELLO_API_KEY || !TRELLO_API_TOKEN || !TRELLO_LIST_ID) {
    console.warn("Trello API credentials missing. Cannot fetch bugs.");
    return [];
  }

  const response = await fetch(`https://api.trello.com/1/lists/${TRELLO_LIST_ID}/cards?attachments=true&key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Trello API Error fetching bugs:", errorText);
    throw new Error("Nem sikerült lekérni a hibajegyeket a Trello-ból.");
  }

  const cards = await response.json();
  
  return cards.map(card => ({
    id: card.id,
    name: card.name,
    desc: card.desc,
    url: card.url,
    labels: card.labels,
    dateLastActivity: card.dateLastActivity,
    attachments: card.attachments ? card.attachments.map(att => ({
      id: att.id,
      name: att.name,
      url: att.url,
      mimeType: att.mimeType,
      previews: att.previews
    })) : []
  }));
};

const STATUS_CONFIG = {
  "Folyamatban": { color: "blue" },
  "Ellenőrzésre vár": { color: "orange" },
  "Kész": { color: "green" }
};

/**
 * Updates the status (adds label) of a bug report in Trello
 * @param {string} cardId - The Trello card ID
 * @param {string} status - 'Folyamatban', 'Ellenőrzésre vár', or 'Kész'
 */
export const updateBugStatus = async (cardId, status) => {
  const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
  const TRELLO_API_TOKEN = process.env.TRELLO_API_TOKEN;

  if (!TRELLO_API_KEY || !TRELLO_API_TOKEN) {
    throw new Error("Trello API credentials missing.");
  }

  // 1. Get Board ID and current labels from card
  const cardResponse = await fetch(`https://api.trello.com/1/cards/${cardId}?fields=idBoard,idLabels,labels&key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`);
  if (!cardResponse.ok) {
    console.error("Trello API Error fetching card details");
    throw new Error("Nem sikerült lekérni a kártya adatait.");
  }
  const cardData = await cardResponse.json();
  const boardId = cardData.idBoard;

  const targetColor = STATUS_CONFIG[status]?.color || "blue";

  // Check if card already has target label
  const hasTargetLabel = cardData.labels && cardData.labels.some(l => l.name === status);
  
  // Find other status labels if they exist on card
  const otherStatusLabels = cardData.labels 
    ? cardData.labels.filter(l => Object.keys(STATUS_CONFIG).some(s => s !== status && s === l.name)) 
    : [];

  if (hasTargetLabel && otherStatusLabels.length === 0) {
    return { success: true }; // Already in correct state
  }

  // 2. Remove other status labels if present
  for (const label of otherStatusLabels) {
    await fetch(`https://api.trello.com/1/cards/${cardId}/idLabels/${label.id}?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`, {
      method: 'DELETE'
    });
  }

  if (!hasTargetLabel) {
    // 3. Get Board labels
    const labelsResponse = await fetch(`https://api.trello.com/1/boards/${boardId}/labels?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`);
    if (!labelsResponse.ok) throw new Error("Nem sikerült lekérni a tábla címkéit.");
    const labels = await labelsResponse.json();

    // 4. Find target label on board
    let targetLabel = labels.find(l => l.name === status);

    // 5. Create target label if not found
    if (!targetLabel) {
      const createLabelResponse = await fetch(`https://api.trello.com/1/labels?name=${encodeURIComponent(status)}&color=${targetColor}&idBoard=${boardId}&key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`, {
        method: 'POST'
      });
      if (!createLabelResponse.ok) throw new Error(`Nem sikerült létrehozni a ${status} címkét.`);
      targetLabel = await createLabelResponse.json();
    }

    // 6. Add label to card
    const addLabelResponse = await fetch(`https://api.trello.com/1/cards/${cardId}/idLabels?value=${targetLabel.id}&key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`, {
      method: 'POST'
    });

    if (!addLabelResponse.ok) {
      console.error("Trello API Error adding label");
      throw new Error(`Nem sikerült rátenni a ${status} címkét a Trello-ban.`);
    }
  }

  return { success: true };
};

/**
 * Gets the attachment buffer and metadata from Trello
 * @param {string} cardId - The Trello card ID
 * @param {string} attachmentId - The attachment ID
 */
export const getBugAttachment = async (cardId, attachmentId) => {
  const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
  const TRELLO_API_TOKEN = process.env.TRELLO_API_TOKEN;

  if (!TRELLO_API_KEY || !TRELLO_API_TOKEN) {
    throw new Error("Trello API credentials missing.");
  }

  // Get attachment info
  const infoResponse = await fetch(`https://api.trello.com/1/cards/${cardId}/attachments/${attachmentId}?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`);
  if (!infoResponse.ok) {
    throw new Error("Failed to get attachment info");
  }
  const info = await infoResponse.json();

  // Download attachment data using OAuth header
  const downloadResponse = await fetch(info.url, {
    headers: {
      'Authorization': `OAuth oauth_consumer_key="${TRELLO_API_KEY}", oauth_token="${TRELLO_API_TOKEN}"`
    }
  });

  if (!downloadResponse.ok) {
    throw new Error("Failed to download attachment data");
  }

  const arrayBuffer = await downloadResponse.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: info.mimeType || 'application/octet-stream',
    name: info.name
  };
};
