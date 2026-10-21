// Pipeline reutilizable: shares + datos del dueño, del destinatario y del recurso.
// Se excluyen recursos inexistentes o en papelera.
export function sharesPipeline(match) {
  return [
    { $match: match },
    { $lookup: { from: 'users', localField: 'ownerId', foreignField: '_id', as: 'owner' } },
    { $lookup: { from: 'users', localField: 'sharedWithId', foreignField: '_id', as: 'sharedWith' } },
    { $lookup: { from: 'files', localField: 'resourceId', foreignField: '_id', as: 'f' } },
    { $lookup: { from: 'folders', localField: 'resourceId', foreignField: '_id', as: 'd' } },
    {
      $addFields: {
        owner: { $arrayElemAt: ['$owner', 0] },
        sharedWith: { $arrayElemAt: ['$sharedWith', 0] },
        recurso: {
          $arrayElemAt: [{ $cond: [{ $eq: ['$resourceType', 'file'] }, '$f', '$d'] }, 0]
        }
      }
    },
    { $match: { recurso: { $ne: null }, 'recurso.deletedAt': null } },
    {
      $project: {
        resourceType: 1, resourceId: 1, permission: 1, createdAt: 1,
        'owner._id': 1, 'owner.nombre': 1, 'owner.email': 1,
        'sharedWith._id': 1, 'sharedWith.nombre': 1, 'sharedWith.email': 1,
        'recurso._id': 1, 'recurso.nombre': 1, 'recurso.extension': 1, 'recurso.size': 1
      }
    },
    { $sort: { createdAt: -1 } }
  ];
}
