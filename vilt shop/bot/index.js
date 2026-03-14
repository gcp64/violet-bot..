// ===========================
// Violet Shop — Discord Bot + Express Backend
// discord.js v14 + Express
// ===========================

const {
    Client,
    GatewayIntentBits,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const express = require('express');
const cors = require('cors');

// ============================
//        CONFIGURATION
// ============================
const CONFIG = {
    TOKEN: 'YOUR_BOT_TOKEN_HERE',              // ← ضع توكن البوت هنا
    SELLER_ID: '326512499186860032',             // ID البائع (Violet)
    ORDERS_CHANNEL_ID: '1482506659963342928',    // قناة الطلبات
    TICKET_CATEGORY_ID: '',                      // (اختياري) ID كاتيجوري التيكتات
    PORT: 3000,                                  // بورت سيرفر Express
};

// ============================
//        DISCORD BOT
// ============================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
    ],
});

client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
    console.log(`📦 Orders channel: ${CONFIG.ORDERS_CHANNEL_ID}`);
    console.log(`🌐 Express server running on port ${CONFIG.PORT}`);
});

// ============================
//     EXPRESS API SERVER
// ============================
const app = express();
app.use(cors());
app.use(express.json());

// --- API Endpoint: Receive Orders from Website ---
app.post('/api/order', async (req, res) => {
    try {
        const { packageName, price, buyerUsername } = req.body;

        // Validate input
        if (!packageName || !price || !buyerUsername) {
            return res.status(400).json({
                success: false,
                message: '❌ جميع الحقول مطلوبة.',
            });
        }

        // Get the orders channel
        const channel = client.channels.cache.get(CONFIG.ORDERS_CHANNEL_ID);
        if (!channel) {
            console.error('❌ Orders channel not found:', CONFIG.ORDERS_CHANNEL_ID);
            return res.status(500).json({
                success: false,
                message: '❌ خطأ داخلي: قناة الطلبات غير موجودة.',
            });
        }

        // Build the Embed
        const orderEmbed = new EmbedBuilder()
            .setTitle('🛒 طلب جديد – Violet Shop')
            .setDescription('تم استلام طلب شراء جديد من الموقع.')
            .setColor(0x2B2D31) // لون داكن متناسق
            .addFields(
                { name: '💰 السعر', value: `\`${price}\``, inline: true },
                { name: '📦 الباقة', value: `\`${packageName}\``, inline: true },
                { name: '👤 المشتري (Discord)', value: `\`${buyerUsername}\``, inline: false },
            )
            .setFooter({ text: 'Violet Shop – نظام الطلبات التلقائي' })
            .setTimestamp();

        // Build the Buttons
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`approve_${buyerUsername}_${Date.now()}`)
                .setLabel('موافقة ✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`decline_${buyerUsername}_${Date.now()}`)
                .setLabel('إلغاء ❌')
                .setStyle(ButtonStyle.Danger),
        );

        // Send the message to the orders channel
        await channel.send({
            embeds: [orderEmbed],
            components: [actionRow],
        });

        console.log(`📩 New order received: ${packageName} — ${price} — @${buyerUsername}`);

        return res.json({
            success: true,
            message: '✅ تم إرسال الطلب بنجاح!',
        });
    } catch (error) {
        console.error('❌ Error processing order:', error);
        return res.status(500).json({
            success: false,
            message: '❌ حدث خطأ أثناء معالجة الطلب.',
        });
    }
});

// Start Express server
app.listen(CONFIG.PORT, () => {
    console.log(`🌐 Express API listening on http://localhost:${CONFIG.PORT}`);
});

// ============================
//   BUTTON INTERACTION HANDLER
// ============================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Only handle our approve/decline buttons
    if (!customId.startsWith('approve_') && !customId.startsWith('decline_')) return;

    // --- Permission Check: Only the seller can use these buttons ---
    if (interaction.user.id !== CONFIG.SELLER_ID) {
        return interaction.reply({
            content: '❌ **ليس لديك صلاحية** للتعامل مع هذا الطلب.',
            ephemeral: true,
        });
    }

    // Extract buyer username from custom_id
    // Format: approve_USERNAME_TIMESTAMP or decline_USERNAME_TIMESTAMP
    const parts = customId.split('_');
    const action = parts[0]; // 'approve' or 'decline'
    const buyerUsername = parts.slice(1, -1).join('_');

    try {
        if (action === 'approve') {
            await handleApprove(interaction, buyerUsername);
        } else if (action === 'decline') {
            await handleDecline(interaction, buyerUsername);
        }
    } catch (error) {
        console.error('❌ Error handling interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ حدث خطأ أثناء معالجة الطلب.',
                ephemeral: true,
            }).catch(() => {});
        }
    }
});

// ============================
//      APPROVE ORDER
// ============================
async function handleApprove(interaction, buyerUsername) {
    await interaction.deferUpdate();

    const guild = interaction.guild;

    // Try to find the buyer member by username
    let buyerMember = null;
    try {
        const members = await guild.members.fetch();
        buyerMember = members.find(
            (m) => m.user.username.toLowerCase() === buyerUsername.toLowerCase()
        );
    } catch (err) {
        console.warn('⚠️ Could not fetch members:', err.message);
    }

    // --- Create Ticket Channel ---
    const ticketName = `ticket-${buyerUsername}`
        .substring(0, 100)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-');

    const permissionOverwrites = [
        {
            id: guild.id, // @everyone — deny
            deny: [PermissionFlagsBits.ViewChannel],
        },
        {
            id: CONFIG.SELLER_ID, // Seller (Violet)
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
            ],
        },
    ];

    // Add buyer permissions if found in server
    if (buyerMember) {
        permissionOverwrites.push({
            id: buyerMember.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
            ],
        });
    }

    const channelOptions = {
        name: ticketName,
        type: ChannelType.GuildText,
        permissionOverwrites,
        topic: `تيكت طلب نيترو — المشتري: ${buyerUsername}`,
    };

    if (CONFIG.TICKET_CATEGORY_ID) {
        channelOptions.parent = CONFIG.TICKET_CATEGORY_ID;
    }

    const ticketChannel = await guild.channels.create(channelOptions);

    // --- Welcome Message in Ticket ---
    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🎫 تيكت جديد — Violet Shop')
        .setDescription(
            `مرحباً! تم فتح هذا التيكت لإتمام عملية الشراء.\n\n` +
            `👤 **المشتري:** \`${buyerUsername}\`\n` +
            (buyerMember
                ? `📎 **المنشن:** <@${buyerMember.id}>\n`
                : `⚠️ *لم يتم العثور على المشتري في السيرفر*\n`) +
            `\nيرجى التواصل هنا لإتمام عملية الدفع والتسليم. 💜`
        )
        .setColor(0x57F287)
        .setTimestamp();

    await ticketChannel.send({
        content: buyerMember ? `<@${buyerMember.id}>` : '',
        embeds: [welcomeEmbed],
    });

    // --- Update Original Embed → Green ---
    const originalEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setColor(0x57F287) // أخضر
        .addFields({
            name: '📌 الحالة',
            value: `✅ **تمت الموافقة** — تيكت: <#${ticketChannel.id}>`,
        });

    const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('approved_done')
            .setLabel('تمت الموافقة ✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('declined_done')
            .setLabel('إلغاء ❌')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true),
    );

    await interaction.message.edit({
        embeds: [updatedEmbed],
        components: [disabledRow],
    });

    console.log(`✅ Approved: "${buyerUsername}" → #${ticketChannel.name}`);
}

// ============================
//      DECLINE ORDER
// ============================
async function handleDecline(interaction, buyerUsername) {
    await interaction.deferUpdate();

    // --- Update Embed → Red ---
    const declinedEmbed = new EmbedBuilder()
        .setTitle('❌ تم رفض الطلب')
        .setDescription(
            `تم رفض طلب الشراء من \`${buyerUsername}\`.\n\n` +
            `🔒 هذا الطلب لم يعد فعالاً.`
        )
        .setColor(0xED4245) // أحمر
        .setFooter({ text: 'Violet Shop – نظام الطلبات التلقائي' })
        .setTimestamp();

    const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('approved_done')
            .setLabel('موافقة ✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('declined_done')
            .setLabel('تم الرفض ❌')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true),
    );

    await interaction.message.edit({
        embeds: [declinedEmbed],
        components: [disabledRow],
    });

    console.log(`❌ Declined: "${buyerUsername}"`);
}

// ============================
//           LOGIN
// ============================
client.login(CONFIG.TOKEN);
