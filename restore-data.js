// СКРИПТ ВОССТАНОВЛЕНИЯ ДАННЫХ
// Выполните этот код в консоли браузера (F12)

async function restoreData() {
  console.log('🔄 Начинаем восстановление данных...');

  // Открываем IndexedDB
  const request = indexedDB.open('BelhardAI', 1);

  request.onsuccess = async (event) => {
    const db = event.target.result;
    console.log('✅ IndexedDB подключена');

    // Шаг 1: Восстанавливаем из localStorage
    const oldSources = localStorage.getItem('belhard_sources');
    const oldChats = localStorage.getItem('belhard_chats');

    if (oldSources) {
      const sources = JSON.parse(oldSources);
      console.log(`📚 Восстанавливаем ${sources.length} документов...`);

      const tx = db.transaction(['documents'], 'readwrite');
      const store = tx.objectStore('documents');

      for (const source of sources) {
        await store.put(source);
      }

      await tx.complete;
      console.log('✅ Документы восстановлены');
    } else {
      console.log('⚠️ Старые документы не найдены в localStorage');
    }

    if (oldChats) {
      const chats = JSON.parse(oldChats);
      console.log(`💬 Восстанавливаем ${chats.length} чатов...`);

      const tx = db.transaction(['chats'], 'readwrite');
      const store = tx.objectStore('chats');

      for (const chat of chats) {
        await store.put(chat);
      }

      await tx.complete;
      console.log('✅ Чаты восстановлены');
    } else {
      console.log('⚠️ Старые чаты не найдены в localStorage');
    }

    console.log('✅ Восстановление завершено! Перезагрузите страницу (F5)');
  };

  request.onerror = (event) => {
    console.error('❌ Ошибка при открытии IndexedDB:', event.target.error);
  };
}

// Запускаем восстановление
restoreData();
