/**
 * GOOGLE APPS SCRIPT CODE (code.gs)
 * Link this script to your Google Sheet ID: 1gY0En53892wKvLmNcmBERy3mIw6PaKrWxLoNJozytKA
 * Deploy as a Web App with access "Anyone"
 */

const SHEET_ID = '1gY0En53892wKvLmNcmBERy3mIw6PaKrWxLoNJozytKA';

function doPost(e) {
  const result = { status: 'success' };
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    if (action === 'sync_users') {
      const sheet = getOrCreateSheet(ss, 'Users');
      sheet.clear();
      // Set headers
      sheet.appendRow(['ID', 'Tài khoản', 'Mật khẩu', 'Quyền', 'Ngày hết hạn', 'Số máy truy cập', 'Mã số thuế', 'Ngày tạo', 'Tên hộ kinh doanh', 'Chủ hộ', 'Địa chỉ đăng ký', 'Địa chỉ kinh doanh']);
      data.users.forEach(u => {
        sheet.appendRow([
          u.id || '',
          u.email, 
          u.password, 
          u.role, 
          u.expiryDate || '', 
          u.maxDevices || '', 
          u.taxCode || '', 
          u.createdAt,
          u.businessName || '',
          u.businessOwner || '',
          u.businessAddress || u.registeredAddress || '',
          u.businessLocation || u.businessAddress || ''
        ]);
      });
    } 
    else if (action === 'sync_business') {
      const sheet = getOrCreateSheet(ss, 'BusinessConfig');
      sheet.clear();
      sheet.appendRow(['Tên hộ kinh doanh', 'Chủ hộ', 'Mã số thuế', 'Địa chỉ đăng ký', 'Địa chỉ kinh doanh']);
      const info = data.info;
      sheet.appendRow([
        info.name, 
        info.owner, 
        info.taxId || info.taxCode, 
        info.address || info.registeredAddress, 
        info.businessLocation || info.businessAddress
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const action = e.parameter.action;
  
  if (action === 'fetch_data') {
    const usersSheet = ss.getSheetByName('Users');
    const businessSheet = ss.getSheetByName('BusinessConfig');
    
    const users = [];
    if (usersSheet) {
      const vals = usersSheet.getDataRange().getValues();
      for (let i = 1; i < vals.length; i++) {
        users.push({
          id: vals[i][0],
          email: vals[i][1],
          password: vals[i][2],
          role: vals[i][3],
          expiryDate: vals[i][4],
          maxDevices: vals[i][5],
          taxCode: vals[i][6],
          createdAt: vals[i][7],
          businessName: vals[i][8],
          businessOwner: vals[i][9],
          businessAddress: vals[i][10],
          businessLocation: vals[i][11]
        });
      }
    }
    
    let businessInfo = null;
    if (businessSheet) {
      const vals = businessSheet.getDataRange().getValues();
      if (vals.length > 1) {
        businessInfo = {
          name: vals[1][0],
          owner: vals[1][1],
          taxId: vals[1][2],
          address: vals[1][3],
          businessLocation: vals[1][4]
        };
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ users, businessInfo })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}
